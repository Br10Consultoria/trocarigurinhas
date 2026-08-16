import {
  ArrowLeftRight,
  Bell,
  CheckCheck,
  Circle,
  Inbox,
  Loader2,
  Radio,
  ShieldAlert,
  ShoppingBag,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

type NotificationCategory = "trade" | "purchase" | "system";
type NotificationFilter = "all" | NotificationCategory;

type NotificationStreamEvent = {
  id?: number;
  kind: "trade_accepted" | "trade_completed" | "system_notice";
  category: NotificationCategory;
  title: string;
  message: string;
};

const filterOptions: Array<{ value: NotificationFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "trade", label: "Trocas" },
  { value: "purchase", label: "Compras" },
  { value: "system", label: "Sistema" },
];

const emptyStates: Record<NotificationFilter, { title: string; description: string }> = {
  all: {
    title: "Nenhuma notificação ainda",
    description: "Quando uma troca ou compra avançar, você verá os avisos importantes aqui.",
  },
  trade: {
    title: "Nenhum alerta de troca",
    description: "Aceites e conclusões de trocas aparecerão nesta categoria.",
  },
  purchase: {
    title: "Nenhum alerta de compra",
    description: "As atualizações das suas compras concluídas aparecerão nesta categoria.",
  },
  system: {
    title: "Nenhum aviso do sistema",
    description: "Avisos importantes de segurança e funcionamento aparecerão aqui.",
  },
};

function formatNotificationDate(value: Date | string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CategoryIcon({ category }: { category: NotificationCategory }) {
  if (category === "purchase") return <ShoppingBag className="h-4 w-4" />;
  if (category === "system") return <ShieldAlert className="h-4 w-4" />;
  return <ArrowLeftRight className="h-4 w-4" />;
}

function categorySurface(category: NotificationCategory) {
  if (category === "purchase") return "bg-violet-100 text-violet-700";
  if (category === "system") return "bg-slate-100 text-slate-700";
  return "bg-orange-100 text-orange-700";
}

export default function NotificationCenter() {
  const utils = trpc.useUtils();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [liveConnected, setLiveConnected] = useState(false);
  const listInput = useMemo(
    () => ({
      limit: 30,
      ...(activeFilter === "all" ? {} : { category: activeFilter }),
    }),
    [activeFilter],
  );
  const unreadInput = useMemo(
    () => (activeFilter === "all" ? undefined : { category: activeFilter }),
    [activeFilter],
  );
  const notificationsQuery = trpc.notifications.list.useQuery(listInput, {
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
    staleTime: 5000,
  });
  const unreadQuery = trpc.notifications.unreadCount.useQuery(unreadInput, {
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
    staleTime: 5000,
  });
  const unreadCountsQuery = trpc.notifications.unreadCounts.useQuery(undefined, {
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
    staleTime: 5000,
  });
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      void utils.notifications.list.invalidate();
      void utils.notifications.unreadCount.invalidate();
      void utils.notifications.unreadCounts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onMutate: async (input) => {
      await Promise.all([
        utils.notifications.list.cancel(listInput),
        utils.notifications.unreadCount.cancel(unreadInput),
        utils.notifications.unreadCounts.cancel(),
      ]);
      const previousList = utils.notifications.list.getData(listInput);
      const previousCount = utils.notifications.unreadCount.getData(unreadInput);
      const previousCounts = utils.notifications.unreadCounts.getData();
      utils.notifications.list.setData(listInput, (current) => current?.map((item) => ({ ...item, isRead: true })));
      utils.notifications.unreadCount.setData(unreadInput, 0);
      utils.notifications.unreadCounts.setData(undefined, (current) => {
        if (!current) return current;
        if (activeFilter === "all") return { all: 0, trade: 0, purchase: 0, system: 0 };
        return {
          ...current,
          all: Math.max(0, current.all - current[activeFilter]),
          [activeFilter]: 0,
        };
      });
      return { previousList, previousCount, previousCounts, input };
    },
    onSuccess: () => {
      toast.success("Notificações atualizadas", {
        description:
          activeFilter === "all"
            ? "Todas as pendências foram marcadas como lidas."
            : `As pendências de ${filterOptions.find((option) => option.value === activeFilter)?.label.toLowerCase()} foram marcadas como lidas.`,
      });
    },
    onError: (error, _input, context) => {
      if (context?.previousList) utils.notifications.list.setData(listInput, context.previousList);
      if (context?.previousCount !== undefined) utils.notifications.unreadCount.setData(unreadInput, context.previousCount);
      if (context?.previousCounts) utils.notifications.unreadCounts.setData(undefined, context.previousCounts);
      toast.error("Não foi possível atualizar as notificações", { description: error.message });
    },
    onSettled: () => {
      void utils.notifications.list.invalidate();
      void utils.notifications.unreadCount.invalidate();
      void utils.notifications.unreadCounts.invalidate();
    },
  });
  const knownIds = useRef(new Set<number>());
  const initialized = useRef(false);
  const lastFilter = useRef<NotificationFilter>(activeFilter);

  useEffect(() => {
    const source = new EventSource("/api/notifications/stream", { withCredentials: true });
    const handleNotification = (event: Event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as NotificationStreamEvent;
        if (payload.id) knownIds.current.add(payload.id);
        toast.info(payload.title, { description: payload.message, duration: 7000 });
        void utils.notifications.list.invalidate();
        void utils.notifications.unreadCount.invalidate();
        void utils.notifications.unreadCounts.invalidate();
      } catch {
        toast.error("Não foi possível interpretar uma notificação recebida.");
      }
    };

    source.addEventListener("notification", handleNotification);
    source.onopen = () => setLiveConnected(true);
    source.onerror = () => setLiveConnected(false);

    return () => {
      source.removeEventListener("notification", handleNotification);
      source.close();
      setLiveConnected(false);
    };
  }, [utils]);

  useEffect(() => {
    const items = notificationsQuery.data;
    if (!items) return;
    const filterChanged = lastFilter.current !== activeFilter;
    if (initialized.current && !filterChanged) {
      items
        .filter((item) => !item.isRead && !knownIds.current.has(item.id))
        .slice(0, 3)
        .forEach((item) => toast.info(item.title, { description: item.message, duration: 7000 }));
    }
    items.forEach((item) => knownIds.current.add(item.id));
    initialized.current = true;
    lastFilter.current = activeFilter;
  }, [activeFilter, notificationsQuery.data]);

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = unreadQuery.data ?? 0;
  const unreadCounts = unreadCountsQuery.data ?? { all: 0, trade: 0, purchase: 0, system: 0 };
  const emptyState = emptyStates[activeFilter];
  const filterLabel = filterOptions.find((option) => option.value === activeFilter)?.label ?? "Todas";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-700"
          aria-label={unreadCount > 0 ? `${unreadCount} notificações não lidas em ${filterLabel.toLowerCase()}` : `Notificações: ${filterLabel}`}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full border-2 border-white bg-orange-500 px-1 text-[10px] text-white shadow-sm">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(410px,calc(100vw-2rem))] rounded-2xl border-slate-200 p-0 shadow-xl">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Notificações</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                <Radio className={`h-3 w-3 ${liveConnected ? "text-emerald-500" : "text-slate-400"}`} />
                {liveConnected ? "Atualização em tempo real" : "Reconectando canal seguro..."}
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                {unreadCount > 99 ? "99+ pendentes" : unreadCount === 1 ? "1 pendente" : `${unreadCount} pendentes`}
              </span>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1" role="tablist" aria-label="Filtrar notificações por categoria">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={activeFilter === option.value}
                onClick={() => setActiveFilter(option.value)}
                className={`min-h-8 flex-1 whitespace-nowrap rounded-lg px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  activeFilter === option.value
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                }`}
              >
                <span>{option.label}</span>
                {unreadCounts[option.value] > 0 && (
                  <span className={`ml-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] ${activeFilter === option.value ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>
                    {unreadCounts[option.value] > 99 ? "99+" : unreadCounts[option.value]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 shadow-none hover:bg-blue-100 hover:text-blue-800 sm:px-3"
              disabled={unreadCount === 0 || markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate(activeFilter === "all" ? undefined : { category: activeFilter })}
              aria-label={unreadCount > 0 ? `Marcar ${unreadCount} notificações como lidas em ${filterLabel.toLowerCase()}` : "Nenhuma notificação pendente"}
              title={`Marcar notificações de ${filterLabel.toLowerCase()} como lidas`}
            >
              {markAllReadMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="mr-1.5 h-3.5 w-3.5" />}
              <span>Marcar {activeFilter === "all" ? "todas" : filterLabel.toLowerCase()} como lidas</span>
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-[min(430px,70vh)]">
          <div className="p-2">
            {notificationsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-blue-600" />Carregando notificações...</div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center"><Inbox className="h-8 w-8 text-blue-200" /><p className="mt-3 text-sm font-semibold text-slate-800">{emptyState.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{emptyState.description}</p></div>
            ) : notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`flex w-full gap-3 rounded-xl p-3 text-left transition hover:bg-blue-50 ${item.isRead ? "opacity-70" : "bg-blue-50/70"}`}
                onClick={() => { if (!item.isRead) markReadMutation.mutate({ id: item.id }); }}
              >
                <span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${categorySurface(item.category)}`}>
                  {item.isRead ? <CheckCheck className="h-4 w-4" /> : <CategoryIcon category={item.category} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-900">{item.title}</span><span className="shrink-0 text-[10px] text-slate-400">{formatNotificationDate(item.createdAt)}</span></span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">{item.message}</span>
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
