import { Bell, CheckCheck, Circle, Inbox, Loader2, Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

type NotificationStreamEvent = {
  id?: number;
  kind: "trade_accepted" | "trade_completed";
  title: string;
  message: string;
};

function formatNotificationDate(value: Date | string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationCenter() {
  const utils = trpc.useUtils();
  const [liveConnected, setLiveConnected] = useState(false);
  const notificationsQuery = trpc.notifications.list.useQuery({ limit: 30 }, {
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
    staleTime: 5000,
  });
  const unreadQuery = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 60000,
    refetchIntervalInBackground: true,
    staleTime: 5000,
  });
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      void utils.notifications.list.invalidate();
      void utils.notifications.unreadCount.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      void utils.notifications.list.invalidate();
      void utils.notifications.unreadCount.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const knownIds = useRef(new Set<number>());
  const initialized = useRef(false);

  useEffect(() => {
    const source = new EventSource("/api/notifications/stream", { withCredentials: true });
    const handleNotification = (event: Event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as NotificationStreamEvent;
        if (payload.id) knownIds.current.add(payload.id);
        toast.info(payload.title, { description: payload.message, duration: 7000 });
        void utils.notifications.list.invalidate();
        void utils.notifications.unreadCount.invalidate();
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
    if (initialized.current) {
      items
        .filter((item) => !item.isRead && !knownIds.current.has(item.id))
        .slice(0, 3)
        .forEach((item) => toast.info(item.title, { description: item.message, duration: 7000 }));
    }
    items.forEach((item) => knownIds.current.add(item.id));
    initialized.current = true;
  }, [notificationsQuery.data]);

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = unreadQuery.data ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-700"
          aria-label={unreadCount > 0 ? `${unreadCount} notificações não lidas` : "Notificações"}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full border-2 border-white bg-orange-500 px-1 text-[10px] text-white shadow-sm">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-2rem))] rounded-2xl border-slate-200 p-0 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Notificações</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <Radio className={`h-3 w-3 ${liveConnected ? "text-emerald-500" : "text-slate-400"}`} />
              {liveConnected ? "Atualização em tempo real" : "Reconectando canal seguro..."}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg px-2 text-xs text-blue-700 hover:bg-blue-50"
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
          >
            {markAllReadMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="mr-1.5 h-3.5 w-3.5" />}
            Marcar todas como lidas
          </Button>
        </div>
        <ScrollArea className="max-h-[min(430px,70vh)]">
          <div className="p-2">
            {notificationsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-blue-600" />Carregando notificações...</div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center"><Inbox className="h-8 w-8 text-blue-200" /><p className="mt-3 text-sm font-semibold text-slate-800">Tudo em dia</p><p className="mt-1 text-xs leading-5 text-slate-500">Você será avisado quando uma troca for aceita ou finalizada.</p></div>
            ) : notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`flex w-full gap-3 rounded-xl p-3 text-left transition hover:bg-blue-50 ${item.isRead ? "opacity-70" : "bg-blue-50/70"}`}
                onClick={() => { if (!item.isRead) markReadMutation.mutate({ id: item.id }); }}
              >
                <span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.kind === "trade_completed" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                  {item.isRead ? <CheckCheck className="h-4 w-4" /> : <Circle className="h-3 w-3 fill-current" />}
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
