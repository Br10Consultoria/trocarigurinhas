import {
  ArrowLeftRight,
  Bell,
  Check,
  CheckCheck,
  Circle,
  Inbox,
  Loader2,
  Radio,
  ShieldAlert,
  ShoppingBag,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

type PendingProposal = {
  reservationId: number;
  notificationId: number;
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
  const [tradeStatusFilter, setTradeStatusFilter] = useState<"all" | "pending" | "accepted" | "declined">("all");
  const [championshipFilter, setChampionshipFilter] = useState<string>("all");
  const [tradeSortBy, setTradeSortBy] = useState<"recent" | "oldest" | "cardId">("recent");
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
  const [resolvedProposalIds, setResolvedProposalIds] = useState<Set<number>>(() => new Set());
  const [pendingAccept, setPendingAccept] = useState<PendingProposal | null>(null);
  const [pendingDecline, setPendingDecline] = useState<PendingProposal | null>(null);
  const respondProposalMutation = trpc.reservas.respondProposal.useMutation({
    onSuccess: (result, variables) => {
      setResolvedProposalIds((current) => new Set(current).add(variables.reservationId));
      setPendingAccept(null);
      setPendingDecline(null);
      toast.success(result.status === "accepted" ? "Proposta aceita" : "Proposta recusada", {
        description: result.status === "accepted" ? "O proponente foi avisado. A reserva continua ativa para concluir a troca em até 24 horas." : "O proponente foi avisado sobre a recusa.",
      });
      void utils.notifications.list.invalidate();
      void utils.notifications.unreadCount.invalidate();
      void utils.notifications.unreadCounts.invalidate();
      void utils.reservas.mine.invalidate();
    },
    onError: (error) => toast.error("Não foi possível responder à proposta", { description: error.message }),
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

  const notificationsRaw = notificationsQuery.data ?? [];
  const availableChampionships = useMemo(() => {
    const set = new Set<string>();
    notificationsRaw.forEach((item: any) => {
      if (item.championship) set.add(item.championship);
    });
    return Array.from(set);
  }, [notificationsRaw]);

  const notifications = useMemo(() => {
    const filtered = notificationsRaw.filter((item: any) => {
      const isTrade = item.category === "trade" && item.reservationId !== null;
      if (activeFilter === "trade") {
        if (tradeStatusFilter !== "all" && isTrade) {
          if (tradeStatusFilter === "pending" && !(item.proposalStatus === "pending" && item.reservationStatus === "active")) return false;
          if (tradeStatusFilter === "accepted" && !(item.proposalStatus === "accepted" || item.reservationStatus === "completed")) return false;
          if (tradeStatusFilter === "declined" && !(item.reservationStatus === "cancelled" || item.reservationStatus === "expired")) return false;
        }
        if (championshipFilter !== "all" && item.championship !== championshipFilter) return false;
      }
      return true;
    });

    if (activeFilter === "trade") {
      return [...filtered].sort((a: any, b: any) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (tradeSortBy === "recent") return timeB - timeA;
        if (tradeSortBy === "oldest") return timeA - timeB;
        if (tradeSortBy === "cardId") return (a.cardId ?? 0) - (b.cardId ?? 0);
        return 0;
      });
    }

    return filtered;
  }, [notificationsRaw, activeFilter, tradeStatusFilter, championshipFilter, tradeSortBy]);

  const tradeEmptyMessage = useMemo(() => {
    if (activeFilter !== "trade" || tradeStatusFilter === "all") return null;
    if (tradeStatusFilter === "pending") return { title: "Nenhuma proposta pendente", description: "Você não possui propostas de troca aguardando resposta no momento." };
    if (tradeStatusFilter === "accepted") return { title: "Nenhuma proposta aceita", description: "Propostas aprovadas ou trocas concluídas aparecerão aqui." };
    if (tradeStatusFilter === "declined") return { title: "Nenhuma proposta recusada ou expirada", description: "Propostas recusadas ou com reserva expirada aparecerão aqui." };
    return null;
  }, [activeFilter, tradeStatusFilter]);
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
                onClick={() => {
                  setActiveFilter(option.value);
                  if (option.value !== "trade") setTradeStatusFilter("all");
                }}
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
          {activeFilter === "trade" && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status:</span>
                {[
                  { value: "all", label: "Todas" },
                  { value: "pending", label: "Pendentes" },
                  { value: "accepted", label: "Aceitas" },
                  { value: "declined", label: "Recusadas" },
                ].map((sub) => (
                  <button
                    key={sub.value}
                    type="button"
                    onClick={() => setTradeStatusFilter(sub.value as any)}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                      tradeStatusFilter === sub.value
                        ? "bg-orange-100 text-orange-800"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
              {availableChampionships.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Álbum:</span>
                  <button
                    type="button"
                    onClick={() => setChampionshipFilter("all")}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition whitespace-nowrap ${
                      championshipFilter === "all"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Todos
                  </button>
                  {availableChampionships.map((champ) => (
                    <button
                      key={champ}
                      type="button"
                      onClick={() => setChampionshipFilter(champ)}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition whitespace-nowrap ${
                        championshipFilter === champ
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {champ}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ordenar:</span>
                {[
                  { value: "recent", label: "Mais recentes" },
                  { value: "oldest", label: "Mais antigas" },
                  { value: "cardId", label: "Nº Figurinha" },
                ].map((sort) => (
                  <button
                    key={sort.value}
                    type="button"
                    onClick={() => setTradeSortBy(sort.value as any)}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                      tradeSortBy === sort.value
                        ? "bg-purple-100 text-purple-800"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {sort.label}
                  </button>
                ))}
              </div>
            </div>
          )}
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
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <Inbox className="h-8 w-8 text-blue-200" />
                <p className="mt-3 text-sm font-semibold text-slate-800">{tradeEmptyMessage?.title ?? emptyState.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{tradeEmptyMessage?.description ?? emptyState.description}</p>
              </div>
            ) : notifications.map((item) => {
              const canRespond = item.actionAvailable && item.reservationId !== null && !resolvedProposalIds.has(item.reservationId);
              const isResponding = respondProposalMutation.isPending && respondProposalMutation.variables?.reservationId === item.reservationId;
              return (
                <div
                  key={item.id}
                  className={`rounded-xl p-3 transition ${item.isRead ? "opacity-70" : "bg-blue-50/70"}`}
                >
                  <button
                    type="button"
                    className="flex w-full gap-3 text-left hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
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
                  {canRespond && (
                    <div className="ml-11 mt-3 flex flex-wrap items-center gap-2">
                      <span className="mr-auto text-[11px] font-medium text-slate-500">Responder à proposta</span>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                        disabled={respondProposalMutation.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          setPendingAccept({ reservationId: item.reservationId!, notificationId: item.id, title: item.title, message: item.message });
                        }}
                        aria-label={`Aceitar proposta da notificação ${item.id}`}
                      >
                        {isResponding && respondProposalMutation.variables?.action === "accept" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                        Aceitar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 shadow-none hover:bg-rose-100 hover:text-rose-800"
                        disabled={respondProposalMutation.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          setPendingDecline({ reservationId: item.reservationId!, notificationId: item.id, title: item.title, message: item.message });
                        }}
                        aria-label={`Recusar proposta da notificação ${item.id}`}
                      >
                        {isResponding && respondProposalMutation.variables?.action === "decline" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
                        Recusar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <AlertDialog
          open={pendingAccept !== null}
          onOpenChange={(open) => {
            if (!open && !respondProposalMutation.isPending) setPendingAccept(null);
          }}
        >
          <AlertDialogContent className="rounded-2xl border-slate-200 sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Revisar aceite da proposta</AlertDialogTitle>
              <AlertDialogDescription>
                Confira os dados abaixo antes de aprovar esta proposta de troca.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Proposta</p>
                <p className="mt-1 font-semibold text-slate-900">{pendingAccept?.title ?? "Proposta de troca"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Detalhes</p>
                <p className="mt-1 leading-5 text-slate-600">{pendingAccept?.message ?? "Confira os detalhes da figurinha antes de confirmar."}</p>
              </div>
              <div className="border-t border-blue-100 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Próxima etapa</p>
                <p className="mt-1 leading-5 text-slate-600">O aceite aprova a proposta e mantém a reserva ativa. A troca ainda deverá ser combinada pelo WhatsApp e concluída em até 24 horas.</p>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={respondProposalMutation.isPending}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500"
                disabled={respondProposalMutation.isPending || pendingAccept === null}
                onClick={(event) => {
                  event.preventDefault();
                  if (!pendingAccept) return;
                  respondProposalMutation.mutate({
                    reservationId: pendingAccept.reservationId,
                    notificationId: pendingAccept.notificationId,
                    action: "accept",
                  });
                }}
              >
                {respondProposalMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                Confirmar aceite
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={pendingDecline !== null}
          onOpenChange={(open) => {
            if (!open && !respondProposalMutation.isPending) setPendingDecline(null);
          }}
        >
          <AlertDialogContent className="rounded-2xl border-slate-200 sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Recusar esta proposta?</AlertDialogTitle>
              <AlertDialogDescription>
                A proposta “{pendingDecline?.title ?? "de troca"}” será recusada e o proponente será avisado. Esta ação não poderá ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={respondProposalMutation.isPending}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500"
                disabled={respondProposalMutation.isPending || pendingDecline === null}
                onClick={(event) => {
                  event.preventDefault();
                  if (!pendingDecline) return;
                  respondProposalMutation.mutate({
                    reservationId: pendingDecline.reservationId,
                    notificationId: pendingDecline.notificationId,
                    action: "decline",
                  });
                }}
              >
                {respondProposalMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <X className="mr-1.5 h-4 w-4" />}
                Confirmar recusa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PopoverContent>
    </Popover>
  );
}
