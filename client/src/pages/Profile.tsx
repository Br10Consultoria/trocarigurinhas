import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Handshake,
  History,
  Loader2,
  MessageCircle,
  RefreshCcw,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";

const typeLabels = { trade: "Troca", purchase: "Compra" } as const;
const conditionLabels = { mint: "Nova", good: "Boa", fair: "Regular", poor: "Marcada" } as const;

type HistoryFilter = "all" | "trade" | "purchase";

function whatsappUrl(value: string | null | undefined) {
  const number = value?.replace(/\D/g, "");
  return number ? `https://wa.me/${number}` : null;
}

function formatMoney(value: string | null) {
  if (!value) return "Valor não informado";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

export default function Profile() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const utils = trpc.useUtils();
  const historyInput = useMemo(() => historyFilter === "all" ? undefined : { type: historyFilter }, [historyFilter]);
  const historyQuery = trpc.negotiations.history.useQuery(historyInput, { enabled: isAuthenticated });
  const reservationsQuery = trpc.reservas.mine.useQuery(undefined, { enabled: isAuthenticated });
  const tokenQuery = trpc.auth.getToken.useQuery(undefined, { enabled: isAuthenticated });
  const completeMutation = trpc.reservas.complete.useMutation({
    onSuccess: () => {
      toast.success("Negociação registrada no seu histórico.");
      void utils.reservas.mine.invalidate();
      void utils.negotiations.history.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const cancelMutation = trpc.reservas.cancel.useMutation({
    onSuccess: () => {
      toast.success("Reserva cancelada.");
      void utils.reservas.mine.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f7faff]"><RefreshCcw className="h-6 w-6 animate-spin text-blue-700" /></div>;
  if (!isAuthenticated || !user) return <div className="flex min-h-screen items-center justify-center bg-[#f7faff] p-6"><Card className="w-full max-w-md rounded-3xl"><CardContent className="p-8 text-center"><UserRound className="mx-auto h-10 w-10 text-blue-700" /><h1 className="mt-4 text-xl font-bold text-slate-950">Entre para abrir seu perfil</h1><p className="mt-2 text-sm text-slate-500">O histórico de negociações é privado e visível somente para o usuário autenticado.</p><Link href="/" className="mt-6 inline-flex h-10 items-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white">Voltar ao marketplace</Link></CardContent></Card></div>;

  const history = historyQuery.data ?? [];
  const reservations = reservationsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-[#f7faff] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white"><UserRound className="h-4 w-4" /></div><div><p className="text-sm font-bold text-blue-950">Meu perfil</p><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">Troca<span className="text-orange-500">Figurinhas</span></p></div></div>
          <div className="flex items-center gap-2"><Link href="/" className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"><ArrowLeft className="h-4 w-4" />Marketplace</Link><Button variant="ghost" size="sm" className="rounded-xl text-slate-500" onClick={() => void logout()}>Sair</Button></div>
        </div>
      </header>

      <main className="container py-8 sm:py-12">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#0b2a5b] px-6 py-8 text-white shadow-xl shadow-blue-950/10 sm:px-10 sm:py-10"><div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" /><div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Área do colecionador</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Olá, {user.name?.split(" ")[0] ?? "colecionador"}.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-blue-100">Acompanhe suas reservas e veja tudo o que já foi concluído em suas negociações.</p></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3"><BadgeCheck className="h-5 w-5 text-orange-300" /><div><p className="text-xs text-blue-200">Conta autenticada</p><p className="text-sm font-semibold">Membro desde {new Date(user.createdAt).toLocaleDateString("pt-BR")}</p></div></div></div></section>

        <Tabs defaultValue="history" className="mt-8">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 overflow-visible rounded-2xl bg-white p-2 shadow-sm sm:w-fit sm:flex-nowrap"><TabsTrigger value="history" className="shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs data-[state=active]:bg-blue-700 data-[state=active]:text-white"><History className="mr-2 h-4 w-4" />Histórico</TabsTrigger><TabsTrigger value="reservations" className="shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs data-[state=active]:bg-blue-700 data-[state=active]:text-white"><Clock3 className="mr-2 h-4 w-4" />Reservas ativas</TabsTrigger><TabsTrigger value="account" className="shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs data-[state=active]:bg-blue-700 data-[state=active]:text-white"><UserRound className="mr-2 h-4 w-4" />Minha conta</TabsTrigger></TabsList>

          <TabsContent value="history" className="mt-6 space-y-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Negociações concluídas</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Seu histórico</h2><p className="mt-2 text-sm text-slate-500">Trocas e compras finalizadas aparecem aqui para consulta.</p></div><div className="flex gap-2 rounded-2xl bg-white p-1.5 shadow-sm"><button onClick={() => setHistoryFilter("all")} className={`rounded-xl px-3 py-2 text-xs font-semibold ${historyFilter === "all" ? "bg-blue-700 text-white" : "text-slate-500 hover:bg-slate-50"}`}>Todos</button><button onClick={() => setHistoryFilter("trade")} className={`rounded-xl px-3 py-2 text-xs font-semibold ${historyFilter === "trade" ? "bg-blue-700 text-white" : "text-slate-500 hover:bg-slate-50"}`}>Trocas</button><button onClick={() => setHistoryFilter("purchase")} className={`rounded-xl px-3 py-2 text-xs font-semibold ${historyFilter === "purchase" ? "bg-blue-700 text-white" : "text-slate-500 hover:bg-slate-50"}`}>Compras</button></div></div>
            {historyQuery.isLoading ? <div className="grid gap-4 md:grid-cols-2"><div className="h-44 animate-pulse rounded-3xl bg-slate-200/70" /><div className="h-44 animate-pulse rounded-3xl bg-slate-200/70" /></div> : history.length === 0 ? <Card className="rounded-3xl border-dashed shadow-sm"><CardContent className="px-6 py-14 text-center"><History className="mx-auto h-9 w-9 text-blue-300" /><h3 className="mt-4 font-semibold text-slate-900">Nenhuma negociação neste filtro</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Quando uma reserva for concluída como troca ou compra, o registro aparecerá aqui.</p><Link href="/" className="mt-5 inline-flex h-10 items-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600">Encontrar figurinhas</Link></CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{history.map((item) => { const counterparty = item.perspective === "seller" ? item.buyer : item.seller; const counterpartyUrl = whatsappUrl(counterparty?.whatsapp); return <Card key={item.negotiation.id} className="rounded-3xl border-slate-200/80 shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.negotiation.type === "purchase" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-700"}`}>{item.negotiation.type === "purchase" ? <CircleDollarSign className="h-5 w-5" /> : <Handshake className="h-5 w-5" />}</div><div><div className="flex items-center gap-2"><Badge className={item.negotiation.type === "purchase" ? "rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-100" : "rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-100"}>{typeLabels[item.negotiation.type]}</Badge><span className="text-xs text-slate-400">#{item.negotiation.id}</span></div><h3 className="mt-2 font-semibold text-slate-950">{item.card?.playerName ?? "Figurinha"} <span className="font-mono text-sm text-slate-500">· #{item.card?.cardNumber}</span></h3><p className="mt-1 text-xs text-slate-500">{item.championship?.name ?? "Coleção"}{item.championship?.year ? ` · ${item.championship.year}` : ""}</p></div></div><Badge variant="secondary" className="rounded-lg bg-emerald-50 text-emerald-700">Concluída</Badge></div><div className="mt-5 grid grid-cols-2 gap-3 border-y border-slate-100 py-4 text-xs"><div><p className="text-slate-400">Sua posição</p><p className="mt-1 font-semibold text-slate-700">{item.perspective === "seller" ? "Doador da figurinha" : "Recebedor da figurinha"}</p></div><div><p className="text-slate-400">Valor</p><p className="mt-1 font-semibold text-slate-700">{item.negotiation.type === "purchase" ? formatMoney(item.negotiation.amount) : "Acordo de troca"}</p></div></div><div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-blue-600" />{formatDate(item.negotiation.completedAt)}</span><span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5 text-blue-600" />{counterparty?.name ?? "Colecionador"}</span>{counterpartyUrl && <a href={counterpartyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>}</div></CardContent></Card>; })}</div>}
          </TabsContent>

          <TabsContent value="reservations" className="mt-6 space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Prazo de 24 horas</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Reservas em andamento</h2><p className="mt-2 text-sm text-slate-500">Conclua a negociação para registrar a troca ou compra no histórico.</p></div>{reservationsQuery.isLoading ? <div className="h-44 animate-pulse rounded-3xl bg-slate-200/70" /> : reservations.length === 0 ? <Card className="rounded-3xl border-dashed"><CardContent className="px-6 py-12 text-center text-sm text-slate-500">Você não possui reservas ativas no momento.</CardContent></Card> : reservations.map((item) => <Card key={item.reservation.id} className="rounded-3xl"><CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><Badge className="rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-100">Reservada</Badge><span className="text-xs text-slate-400">Expira em {formatDate(item.reservation.expiresAt)}</span></div><h3 className="mt-3 font-semibold text-slate-950">{item.card?.playerName ?? "Figurinha"} <span className="font-mono text-sm text-slate-500">· #{item.card?.cardNumber}</span></h3><p className="mt-1 text-xs text-slate-500">{item.championship?.name ?? "Coleção"} · Dono: {item.owner?.name ?? "Colecionador"}</p></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><div className="flex items-center gap-2"><span className="text-xs font-semibold text-slate-500">Preço</span><Input aria-label={`Preço da reserva ${item.reservation.id}`} type="number" min="0" step="0.01" value={amounts[item.reservation.id] ?? ""} onChange={(event) => setAmounts((current) => ({ ...current, [item.reservation.id]: event.target.value }))} placeholder="opcional" className="h-9 w-28 rounded-xl" /></div><Button size="sm" className="rounded-xl bg-blue-700 hover:bg-blue-800" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate({ id: item.reservation.id, type: "trade" })}><Handshake className="mr-1.5 h-3.5 w-3.5" />Concluir troca</Button><Button size="sm" variant="outline" className="rounded-xl border-orange-200 text-orange-700 hover:bg-orange-50" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate({ id: item.reservation.id, type: "purchase", amount: amounts[item.reservation.id] ? Number(amounts[item.reservation.id]) : undefined })}><CircleDollarSign className="mr-1.5 h-3.5 w-3.5" />Registrar compra</Button><Button size="sm" variant="ghost" className="rounded-xl text-slate-500" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate({ id: item.reservation.id })}>Cancelar</Button></div></CardContent></Card>)}</TabsContent>

          <TabsContent value="account" className="mt-6"><div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><Card className="rounded-3xl"><CardHeader><CardTitle className="text-lg">Dados cadastrados</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-slate-400">Nome</p><p className="mt-1 font-semibold text-slate-800">{user.name ?? "Não informado"}</p></div><div><p className="text-xs text-slate-400">E-mail</p><p className="mt-1 break-all font-semibold text-slate-800">{user.email ?? "Não informado"}</p></div><div><p className="text-xs text-slate-400">WhatsApp</p><p className="mt-1 font-semibold text-slate-800">{user.whatsapp ?? "Não informado"}</p></div><div><p className="text-xs text-slate-400">Telefone</p><p className="mt-1 font-semibold text-slate-800">{user.phone ?? "Não informado"}</p></div></CardContent></Card><Card className="rounded-3xl border-blue-100 bg-blue-50/60"><CardHeader><CardTitle className="text-lg text-blue-950">Seu token único</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-blue-800">Use este identificador quando precisar confirmar sua conta com o suporte.</p><code className="mt-4 block break-all rounded-xl bg-white p-3 font-mono text-xs text-blue-800 shadow-sm">{tokenQuery.data?.token ?? "Carregando…"}</code></CardContent></Card></div></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
