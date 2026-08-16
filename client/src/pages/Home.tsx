import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Filter,
  LogOut,
  PackageSearch,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const conditionLabels = { mint: "Nova", good: "Boa", fair: "Regular", poor: "Marcada" } as const;
const typeLabels = { duplicate: "Repetida", needed: "Necessária" } as const;

type CardResult = {
  card: {
    id: number;
    cardNumber: string;
    playerName: string;
    type: keyof typeof typeLabels;
    condition: keyof typeof conditionLabels;
    price: string | null;
    notes: string | null;
    status: string;
  };
  owner: { id: number; name: string | null; whatsapp: string | null } | null;
  championship: { id: number; name: string; year: number | null } | null;
};

function formatPrice(value: string | null) {
  if (!value) return "Troca ou proposta";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function whatsappUrl(value: string | null | undefined) {
  const number = value?.replace(/\D/g, "");
  return number ? `https://wa.me/${number}` : null;
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <PackageSearch className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-slate-950">Nenhuma figurinha encontrada</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {hasFilters ? "Tente ajustar os filtros ou buscar por outro número, nome ou campeonato." : "As novas oportunidades de troca aparecerão aqui assim que colecionadores cadastrarem suas figurinhas."}
      </p>
      {hasFilters && <Button variant="outline" className="mt-6 rounded-xl" onClick={onClear}><X className="mr-2 h-4 w-4" />Limpar filtros</Button>}
    </div>
  );
}

function CardItem({ item, onReserve, isReserving }: { item: CardResult; onReserve: (id: number) => void; isReserving: boolean }) {
  const contactUrl = whatsappUrl(item.owner?.whatsapp);
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_38px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_50px_rgba(15,23,42,0.09)]">
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-[3rem] bg-orange-50 transition group-hover:bg-orange-100" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-mono text-xs font-bold text-blue-700">#{item.card.cardNumber}</span>
            <Badge variant="secondary" className="rounded-lg bg-slate-100 text-[11px] font-medium text-slate-600">{typeLabels[item.card.type]}</Badge>
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-950">{item.card.playerName}</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">{item.championship?.name ?? "Coleção não informada"}{item.championship?.year ? ` · ${item.championship.year}` : ""}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20"><Tag className="h-5 w-5" /></div>
      </div>
      <div className="relative mt-5 grid grid-cols-2 gap-3 border-y border-slate-100 py-4 text-xs">
        <div><p className="text-slate-400">Conservação</p><p className="mt-1 font-semibold text-slate-700">{conditionLabels[item.card.condition]}</p></div>
        <div><p className="text-slate-400">Proposta</p><p className="mt-1 font-semibold text-slate-700">{formatPrice(item.card.price)}</p></div>
      </div>
      <div className="relative mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500"><UserRound className="h-4 w-4 shrink-0 text-blue-600" /><span className="truncate">{item.owner?.name ?? "Colecionador"}</span></div>
        <div className="flex gap-2">
          {contactUrl && <a href={contactUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">WhatsApp</a>}
          <Button size="sm" className="h-9 rounded-xl bg-blue-700 px-3 text-xs hover:bg-blue-800" onClick={() => onReserve(item.card.id)} disabled={isReserving}><Clock3 className="mr-1.5 h-3.5 w-3.5" />Reservar</Button>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [championshipId, setChampionshipId] = useState("all");
  const [type, setType] = useState("all");
  const [condition, setCondition] = useState("all");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(draftSearch.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [draftSearch]);

  const filters = useMemo(() => ({
    search: search || undefined,
    championshipId: championshipId === "all" ? undefined : Number(championshipId),
    type: type === "all" ? undefined : type as "duplicate" | "needed",
    condition: condition === "all" ? undefined : condition as "mint" | "good" | "fair" | "poor",
    sort: sort as "newest" | "cardNumber" | "playerName",
  }), [search, championshipId, type, condition, sort]);

  const utils = trpc.useUtils();
  const championshipsQuery = trpc.championships.getAll.useQuery(undefined, { enabled: isAuthenticated });
  const marketplaceQuery = trpc.figurinhas.list.useQuery(filters, { enabled: isAuthenticated, placeholderData: (previous) => previous });
  const reserveMutation = trpc.reservas.create.useMutation({
    onSuccess: (data) => {
      toast.success("Figurinha reservada por 24 horas.", { description: `Prazo final: ${new Date(data.expiresAt).toLocaleString("pt-BR")}` });
      void utils.figurinhas.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const clearFilters = () => { setDraftSearch(""); setSearch(""); setChampionshipId("all"); setType("all"); setCondition("all"); setSort("newest"); };
  const hasFilters = Boolean(search || championshipId !== "all" || type !== "all" || condition !== "all");
  const cards = (marketplaceQuery.data ?? []) as CardResult[];

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f7faff]"><RefreshCcw className="h-6 w-6 animate-spin text-blue-700" /></div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen overflow-hidden bg-[#f7faff] text-slate-950">
        <header className="relative z-10 border-b border-white/10 bg-[#0b2a5b] text-white"><div className="container flex h-20 items-center justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/25"><Sparkles className="h-5 w-5" /></div><span className="text-lg font-bold tracking-tight">Troca<span className="text-orange-400">Figurinhas</span></span></div><Button onClick={() => startLogin()} className="rounded-xl bg-white text-blue-900 hover:bg-blue-50">Entrar na plataforma<ArrowRight className="ml-2 h-4 w-4" /></Button></div></header>
        <main><section className="relative isolate overflow-hidden bg-[#0b2a5b] pb-24 pt-16 text-white"><div className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" /><div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" /><div className="container relative grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]"><div><p className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-300/30 bg-orange-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-orange-200"><Sparkles className="h-3.5 w-3.5" />Comunidade de colecionadores</p><h1 className="max-w-2xl text-4xl font-bold leading-[1.06] tracking-tight sm:text-6xl">Encontre a figurinha que falta. <span className="text-orange-400">Complete sua coleção.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-blue-100 sm:text-lg">Um espaço seguro para trocar, reservar ou comprar figurinhas de diferentes campeonatos diretamente com outros colecionadores.</p><div className="mt-9 flex flex-wrap gap-3"><Button onClick={() => startLogin()} size="lg" className="rounded-2xl bg-orange-500 px-6 font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-400">Criar minha conta<ArrowRight className="ml-2 h-4 w-4" /></Button><div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 text-sm text-blue-100"><ShieldCheck className="h-4 w-4 text-orange-300" />Acesso protegido para membros</div></div></div><div className="relative mx-auto w-full max-w-md"><div className="absolute -inset-4 rounded-[2rem] bg-orange-500/20 blur-2xl" /><div className="relative rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur"><div className="flex items-center justify-between border-b border-white/10 pb-4"><div><p className="text-xs uppercase tracking-[0.16em] text-blue-200">Seu próximo álbum</p><p className="mt-1 text-lg font-semibold">Copa do Mundo</p></div><BookOpen className="h-6 w-6 text-orange-300" /></div><div className="mt-5 grid grid-cols-3 gap-3">{["01", "07", "24", "42", "88", "99"].map((number, index) => <div key={number} className={`aspect-[0.78] rounded-2xl p-3 ${index % 2 ? "bg-orange-400" : "bg-blue-400/40"}`}><div className="flex h-full flex-col justify-between"><span className="font-mono text-xs font-semibold text-white/80">{number}</span><div className="h-2 w-8 rounded-full bg-white/40" /></div></div>)}</div><div className="mt-5 rounded-2xl bg-white p-4 text-slate-900"><div className="flex items-center justify-between text-sm"><span className="font-medium">Sua coleção</span><span className="font-bold text-orange-500">68%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full w-[68%] rounded-full bg-orange-500" /></div></div></div></div></div></section><section className="container -mt-8 relative z-10 pb-20"><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-blue-950/5"><PackageSearch className="h-5 w-5 text-blue-700" /><p className="mt-4 font-semibold">Busque com precisão</p><p className="mt-1 text-sm leading-6 text-slate-500">Número, atleta, álbum ou campeonato.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-blue-950/5"><Clock3 className="h-5 w-5 text-orange-500" /><p className="mt-4 font-semibold">Reserve por 24h</p><p className="mt-1 text-sm leading-6 text-slate-500">Tempo para combinar a troca ou compra.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-blue-950/5"><ShieldCheck className="h-5 w-5 text-blue-700" /><p className="mt-4 font-semibold">Contato direto</p><p className="mt-1 text-sm leading-6 text-slate-500">Negocie pelo WhatsApp do colecionador.</p></div></div></section></main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7faff] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="container flex h-16 items-center justify-between gap-5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white"><Sparkles className="h-4 w-4" /></div><div><p className="text-sm font-bold leading-none text-blue-950">Troca<span className="text-orange-500">Figurinhas</span></p><p className="mt-1 hidden text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 sm:block">Marketplace de colecionadores</p></div></div><div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800 sm:flex"><UserRound className="h-4 w-4" />{user?.name ?? "Minha conta"}</div><Button variant="ghost" size="sm" className="rounded-xl text-slate-500 hover:bg-slate-100" onClick={() => void logout()}><LogOut className="mr-2 h-4 w-4" />Sair</Button></div></div></header>
      <main className="container py-8 sm:py-12"><section className="relative overflow-hidden rounded-[2rem] bg-[#0b2a5b] px-6 py-8 text-white shadow-xl shadow-blue-950/10 sm:px-10 sm:py-10"><div className="absolute -right-16 -top-28 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" /><div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Marketplace</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Encontre sua próxima figurinha</h1><p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">Pesquise pelo número, jogador, coleção ou campeonato. Filtre as oportunidades e reserve diretamente com outro colecionador.</p></div><div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500"><Search className="h-5 w-5" /></div><div><p className="text-xs text-blue-200">Acesso autenticado</p><p className="text-sm font-semibold">Olá, {user?.name?.split(" ")[0] ?? "colecionador"}</p></div></div></div></section>
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-3 lg:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Buscar figurinhas" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Buscar por número, jogador, álbum ou campeonato..." className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-11 pr-10 text-sm focus-visible:ring-blue-600" />{draftSearch && <button aria-label="Limpar busca" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" onClick={() => setDraftSearch("")}><X className="h-4 w-4" /></button>}</div><Button variant={showFilters ? "default" : "outline"} className={`h-12 rounded-2xl px-5 ${showFilters ? "bg-blue-700 hover:bg-blue-800" : "border-slate-200"}`} onClick={() => setShowFilters((value) => !value)}><Filter className="mr-2 h-4 w-4" />Filtros{hasFilters && <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] text-white">!</span>}</Button></div>{showFilters && <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-semibold text-slate-600">Campeonato<select value={championshipId} onChange={(event) => setChampionshipId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="all">Todos os campeonatos</option>{(championshipsQuery.data ?? []).map((championship) => <option key={championship.id} value={String(championship.id)}>{championship.name}{championship.year ? ` · ${championship.year}` : ""}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Tipo<select value={type} onChange={(event) => setType(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="all">Repetidas e necessárias</option><option value="duplicate">Repetidas para troca</option><option value="needed">Necessárias</option></select></label><label className="text-xs font-semibold text-slate-600">Conservação<select value={condition} onChange={(event) => setCondition(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="all">Qualquer estado</option><option value="mint">Nova</option><option value="good">Boa</option><option value="fair">Regular</option><option value="poor">Marcada</option></select></label><label className="text-xs font-semibold text-slate-600">Ordenar por<select value={sort} onChange={(event) => setSort(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="newest">Mais recentes</option><option value="cardNumber">Número da figurinha</option><option value="playerName">Nome do jogador</option></select></label></div>}{hasFilters && <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><p className="text-xs text-slate-500">Filtros ativos para refinar seus resultados.</p><button onClick={clearFilters} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900"><RefreshCcw className="h-3.5 w-3.5" />Limpar tudo</button></div>}</section>
        <div className="mt-8 flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Oportunidades abertas</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Figurinhas disponíveis</h2></div><div className="hidden items-center gap-1 text-xs text-slate-500 sm:flex"><ChevronDown className="h-4 w-4 rotate-180 text-blue-600" />Atualização em tempo real</div></div>
        <section className="mt-5">{marketplaceQuery.isLoading ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-3xl bg-slate-200/70" />)}</div> : marketplaceQuery.isError ? <div className="rounded-3xl border border-red-100 bg-red-50 p-8 text-center text-sm text-red-700">Não foi possível carregar as figurinhas agora. Tente atualizar a página.</div> : cards.length === 0 ? <EmptyState hasFilters={hasFilters} onClear={clearFilters} /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{cards.map((item) => <CardItem key={item.card.id} item={item} onReserve={(id) => reserveMutation.mutate({ figurinhaId: id })} isReserving={reserveMutation.isPending} />)}</div>}</section>
      </main>
    </div>
  );
}
