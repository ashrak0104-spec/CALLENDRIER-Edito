import { useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  MessageCircle,
  Paperclip,
  Pencil,
  Plus,
  Repeat2,
  Send,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { ChecklistProgress, PillarBadge, PlatformBadge, StatusBadge } from './Badges';
import { useToast } from './Toast';
import { FORMATS, PILLARS, PLATFORMS, PLATFORM_META, STATUSES } from '../constants';
import { isDesktop, api } from '../lib/api';
import {
  formatDayMonth,
  formatTime,
  fromDatetimeLocal,
  toDatetimeLocal,
} from '../lib/dates';
import { cx, initials, uid } from '../lib/utils';
import { useEditorial } from '../store/editorial';
import type { DrawerTab, Platform, PostItem, Status } from '../types';

interface ItemDrawerProps {
  itemId: string;
  initialTab: DrawerTab;
  onClose: () => void;
  onOpenItem: (id: string) => void;
}

const PREVIEW_LIMITS = { linkedin: 420, x: 280 } as const;

export default function ItemDrawer({
  itemId,
  initialTab,
  onClose,
  onOpenItem,
}: ItemDrawerProps) {
  const { items, updateItem, deleteItem, duplicateItem } = useEditorial();
  const toast = useToast();

  const item = items.find((entry) => entry.id === itemId);

  const [tab, setTab] = useState<DrawerTab>(initialTab);
  const [tagDraft, setTagDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewVariant, setPreviewVariant] = useState<'linkedin' | 'x'>(() => {
    const current = items.find((entry) => entry.id === itemId);
    return current?.platform === 'X/Twitter' ? 'x' : 'linkedin';
  });
  const [showFullText, setShowFullText] = useState(false);

  if (!item) return null;

  const patch = (values: Partial<PostItem>) => updateItem(item.id, values);
  const limit = PLATFORM_META[item.platform].limit;
  const overLimit = item.content.length > limit;
  const doneTasks = item.checklist.filter((task) => task.done).length;

  const addTag = () => {
    const value = tagDraft.trim().replace(/,+$/, '');
    if (!value) return;
    if (!item.tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      patch({ tags: [...item.tags, value] });
    }
    setTagDraft('');
  };

  const removeTag = (tag: string) => patch({ tags: item.tags.filter((entry) => entry !== tag) });

  const addTask = () => {
    const text = taskDraft.trim();
    if (!text) return;
    patch({ checklist: [...item.checklist, { id: uid(), text, done: false }] });
    setTaskDraft('');
  };

  const toggleTask = (taskId: string) => {
    patch({
      checklist: item.checklist.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    });
  };

  const attachFiles = async () => {
    if (!isDesktop) {
      toast('La sélection de fichiers locaux est disponible dans l’application desktop.', 'info');
      return;
    }
    const paths = await api.pickAssets();
    if (paths.length === 0) return;
    patch({
      assets: [
        ...item.assets,
        ...paths.map((target) => ({
          id: uid(),
          label: target.split(/[\\/]/).pop() || target,
          target,
          kind: 'file' as const,
        })),
      ],
    });
  };

  const addLink = () => {
    const target = linkUrl.trim();
    if (!target) return;
    const normalized = /^https?:\/\//i.test(target) ? target : `https://${target}`;
    patch({
      assets: [
        ...item.assets,
        { id: uid(), label: linkLabel.trim() || normalized, target: normalized, kind: 'link' },
      ],
    });
    setLinkLabel('');
    setLinkUrl('');
    setLinkFormOpen(false);
  };

  const handleDuplicate = (platform: Platform) => {
    const clone = duplicateItem(item.id, platform);
    setDupOpen(false);
    if (!clone) return;
    toast(`Copie créée pour ${platform} dans le backlog.`);
    onOpenItem(clone.id);
  };

  const handleDelete = () => {
    deleteItem(item.id);
    toast('Contenu supprimé.', 'info');
    onClose();
  };

  const previewText = item.content || 'Votre contenu apparaîtra ici.';
  const truncation = PREVIEW_LIMITS[previewVariant];
  const isTruncated = previewText.length > truncation;
  const visibleText = showFullText ? previewText : previewText.slice(0, truncation);
  const handle = (item.assignee || 'studio')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Fermer l'éditeur"
        className="absolute inset-0 cursor-default bg-slate-950/45 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside className="animate-drawer-in relative flex h-full w-full max-w-[600px] flex-col border-l border-line bg-surface shadow-pop">
        <header className="border-b border-line px-5 pb-0 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <PlatformBadge platform={item.platform} />
                <StatusBadge status={item.status} />
                <PillarBadge pillar={item.pillar} />
              </div>
              <h2 className="mt-2 truncate text-lg font-bold tracking-tight">
                {item.title || 'Nouveau contenu'}
              </h2>
              <p className="mt-0.5 text-[11px] text-muted">
                {item.scheduledDate
                  ? `${formatDayMonth(item.scheduledDate)} à ${formatTime(item.scheduledDate)}`
                  : 'Non planifié'}
                {item.assignee ? ` · ${item.assignee}` : ''}
              </p>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
              <X size={18} />
            </button>
          </div>

          <div className="mt-3 flex gap-1">
            {(
              [
                { id: 'edit' as DrawerTab, label: 'Édition', icon: Pencil },
                { id: 'preview' as DrawerTab, label: 'Aperçu live', icon: Eye },
              ]
            ).map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTab(entry.id)}
                  className={cx(
                    'inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition',
                    tab === entry.id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted hover:text-ink',
                  )}
                >
                  <Icon size={14} />
                  {entry.label}
                </button>
              );
            })}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === 'edit' ? (
            <div className="space-y-5">
              <div>
                <label className="label" htmlFor="drawer-title">
                  Titre / accroche
                </label>
                <input
                  id="drawer-title"
                  className="field"
                  value={item.title}
                  placeholder="Ex. Les 5 erreurs qui plombent votre calendrier"
                  onChange={(event) => patch({ title: event.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="drawer-platform">
                    Plateforme
                  </label>
                  <select
                    id="drawer-platform"
                    className="field"
                    value={item.platform}
                    onChange={(event) => patch({ platform: event.target.value as Platform })}
                  >
                    {PLATFORMS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="drawer-format">
                    Format
                  </label>
                  <select
                    id="drawer-format"
                    className="field"
                    value={item.format}
                    onChange={(event) =>
                      patch({ format: event.target.value as PostItem['format'] })
                    }
                  >
                    {FORMATS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="drawer-status">
                    Statut
                  </label>
                  <select
                    id="drawer-status"
                    className="field"
                    value={item.status}
                    onChange={(event) => patch({ status: event.target.value as Status })}
                  >
                    {STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="drawer-pillar">
                    Pilier éditorial
                  </label>
                  <select
                    id="drawer-pillar"
                    className="field"
                    value={item.pillar}
                    onChange={(event) =>
                      patch({ pillar: event.target.value as PostItem['pillar'] })
                    }
                  >
                    {PILLARS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="drawer-date">
                    Date & heure
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="drawer-date"
                      type="datetime-local"
                      className="field"
                      value={toDatetimeLocal(item.scheduledDate)}
                      onChange={(event) =>
                        patch({ scheduledDate: fromDatetimeLocal(event.target.value) })
                      }
                    />
                    {item.scheduledDate && (
                      <button
                        type="button"
                        className="btn-ghost shrink-0 !px-2"
                        title="Retirer la planification"
                        onClick={() => patch({ scheduledDate: null })}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="drawer-assignee">
                    Auteur / créateur
                  </label>
                  <input
                    id="drawer-assignee"
                    className="field"
                    value={item.assignee}
                    placeholder="Nom"
                    onChange={(event) => patch({ assignee: event.target.value })}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-end justify-between gap-2">
                  <label className="label mb-0" htmlFor="drawer-content">
                    Corps / script / brief
                  </label>
                  <span
                    className={cx(
                      'text-[10px] font-medium tabular-nums',
                      overLimit ? 'text-rose-500' : 'text-muted',
                    )}
                  >
                    {item.content.length.toLocaleString('fr-FR')} /{' '}
                    {limit.toLocaleString('fr-FR')} caractères
                  </span>
                </div>
                <textarea
                  id="drawer-content"
                  className="field min-h-[180px] resize-y leading-relaxed"
                  rows={9}
                  value={item.content}
                  placeholder="Écrivez le texte, le script ou le brief de production…"
                  onChange={(event) => patch({ content: event.target.value })}
                />
                {overLimit && (
                  <p className="mt-1 text-[10px] text-rose-500">
                    Cette plateforme affiche environ {limit.toLocaleString('fr-FR')} caractères.
                  </p>
                )}
              </div>

              <div>
                <span className="label">Tags / campagne</span>
                <input
                  className="field"
                  value={tagDraft}
                  placeholder="Ajouter un mot-clé puis Entrée"
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                />
                {item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-raised px-2 py-0.5 text-[11px] text-ink"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="text-muted transition hover:text-rose-500"
                          aria-label={`Retirer ${tag}`}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="label mb-0">Checklist de validation</span>
                  <span className="text-[10px] font-medium tabular-nums text-muted">
                    {doneTasks}/{item.checklist.length}
                  </span>
                </div>
                <ChecklistProgress done={doneTasks} total={item.checklist.length} className="mb-2" />
                <div className="space-y-1.5">
                  {item.checklist.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className={cx(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                          task.done
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-line text-transparent hover:border-accent',
                        )}
                        aria-label={task.done ? 'Décocher' : 'Cocher'}
                      >
                        <Check size={11} />
                      </button>
                      <span
                        className={cx(
                          'min-w-0 flex-1 truncate text-xs',
                          task.done && 'text-muted line-through',
                        )}
                      >
                        {task.text}
                      </span>
                      <button
                        type="button"
                        className="text-muted transition hover:text-rose-500"
                        onClick={() =>
                          patch({
                            checklist: item.checklist.filter((entry) => entry.id !== task.id),
                          })
                        }
                        aria-label={`Supprimer ${task.text}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-1.5">
                  <input
                    className="field"
                    value={taskDraft}
                    placeholder="Nouvelle sous-tâche (Entrée pour ajouter)"
                    onChange={(event) => setTaskDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addTask();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost shrink-0 !px-2.5"
                    onClick={addTask}
                    aria-label="Ajouter la sous-tâche"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              <div>
                <span className="label">Ressources</span>
                <div className="space-y-1.5">
                  {item.assets.length === 0 && (
                    <p className="rounded-lg border border-dashed border-line px-3 py-3 text-center text-[11px] text-muted">
                      Aucun fichier ou lien attaché.
                    </p>
                  )}
                  {item.assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5"
                    >
                      {asset.kind === 'file' ? (
                        <Paperclip size={13} className="shrink-0 text-muted" />
                      ) : (
                        <Link2 size={13} className="shrink-0 text-muted" />
                      )}
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-xs text-ink hover:text-accent"
                        title={asset.target}
                        onClick={() => api.openTarget(asset.target)}
                      >
                        {asset.label}
                      </button>
                      <ExternalLink size={12} className="shrink-0 text-muted" />
                      <button
                        type="button"
                        className="text-muted transition hover:text-rose-500"
                        onClick={() =>
                          patch({ assets: item.assets.filter((entry) => entry.id !== asset.id) })
                        }
                        aria-label={`Retirer ${asset.label}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {linkFormOpen ? (
                  <div className="mt-2 space-y-1.5 rounded-lg border border-line bg-raised/40 p-2">
                    <input
                      className="field-sm w-full"
                      placeholder="Libellé (optionnel)"
                      value={linkLabel}
                      onChange={(event) => setLinkLabel(event.target.value)}
                    />
                    <div className="flex gap-1.5">
                      <input
                        className="field-sm w-full"
                        placeholder="https://…"
                        value={linkUrl}
                        onChange={(event) => setLinkUrl(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addLink();
                          }
                        }}
                      />
                      <button type="button" className="btn-primary !px-2.5 !py-1 text-xs" onClick={addLink}>
                        OK
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-2.5 !py-1 text-xs"
                        onClick={() => setLinkFormOpen(false)}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-1.5">
                    <button type="button" className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={attachFiles}>
                      <Paperclip size={13} />
                      Joindre un fichier
                    </button>
                    <button
                      type="button"
                      className="btn-ghost !px-2.5 !py-1.5 text-xs"
                      onClick={() => setLinkFormOpen(true)}
                    >
                      <Link2 size={13} />
                      Ajouter un lien
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between gap-2">
                <div className="flex rounded-lg border border-line bg-surface p-0.5">
                  {(['linkedin', 'x'] as const).map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      onClick={() => {
                        setPreviewVariant(variant);
                        setShowFullText(false);
                      }}
                      className={cx(
                        'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                        previewVariant === variant
                          ? 'bg-accent text-white dark:text-slate-950'
                          : 'text-muted hover:text-ink',
                      )}
                    >
                      {variant === 'linkedin' ? 'LinkedIn' : 'X / Twitter'}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted">
                  Aperçu du rendu
                </span>
              </div>

              {previewVariant === 'linkedin' ? (
                <article className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
                  <header className="flex items-start gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                      {initials(item.assignee)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {item.assignee || 'Votre nom'}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {item.pillar} · {item.format}
                      </p>
                      <p className="text-[10px] text-muted">maintenant · 🌐</p>
                    </div>
                  </header>

                  <div className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-ink">
                    {visibleText}
                    {isTruncated && !showFullText ? '…' : ''}
                  </div>
                  {isTruncated && (
                    <button
                      type="button"
                      onClick={() => setShowFullText((value) => !value)}
                      className="mt-1 text-xs font-semibold text-muted transition hover:text-ink hover:underline"
                    >
                      {showFullText ? 'Voir moins' : 'Voir plus'}
                    </button>
                  )}

                  {item.tags.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-x-1.5 text-xs font-medium text-accent">
                      {item.tags.map((tag) => (
                        <span key={tag}>#{tag.replace(/\s+/g, '')}</span>
                      ))}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-[10px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp size={12} /> 128
                    </span>
                    <span>24 commentaires · 6 republications</span>
                  </div>
                  <div className="mt-2 flex items-center justify-around border-t border-line pt-2 text-[11px] font-medium text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <ThumbsUp size={14} /> J’aime
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MessageCircle size={14} /> Commenter
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Repeat2 size={14} /> Republier
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Send size={14} /> Envoyer
                    </span>
                  </div>
                </article>
              ) : (
                <article className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
                  <header className="flex items-start gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-xs font-bold text-white">
                      {initials(item.assignee)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold text-ink">
                          {item.assignee || 'Votre nom'}
                        </p>
                        <span className="truncate text-[11px] text-muted">@{handle}</span>
                        <span className="text-[11px] text-muted">· maintenant</span>
                      </div>
                      <p className="text-[11px] text-muted">
                        {item.platform} · {item.format}
                      </p>
                    </div>
                    <span className="text-muted">···</span>
                  </header>

                  <div className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-ink">
                    {visibleText}
                    {isTruncated && !showFullText ? '…' : ''}
                  </div>
                  {isTruncated && (
                    <button
                      type="button"
                      onClick={() => setShowFullText((value) => !value)}
                      className="mt-1 text-xs font-medium text-sky-500 hover:underline"
                    >
                      {showFullText ? 'Afficher moins' : 'Afficher plus'}
                    </button>
                  )}

                  {item.tags.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-x-1.5 text-xs font-medium text-sky-500">
                      {item.tags.map((tag) => (
                        <span key={tag}>#{tag.replace(/\s+/g, '')}</span>
                      ))}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle size={13} /> 18
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Repeat2 size={13} /> 42
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp size={13} /> 310
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Send size={13} />
                    </span>
                  </div>
                </article>
              )}

              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                Aperçu indicatif : la troncature « Voir plus » apparaît au-delà de{' '}
                {truncation} caractères.
              </p>
            </div>
          )}
        </div>

        <footer className="border-t border-line bg-surface px-5 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {confirmDelete ? (
                <>
                  <span className="text-xs text-muted">Supprimer ?</span>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-500 transition hover:bg-rose-500/10"
                    onClick={handleDelete}
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-raised"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-rose-500/10 hover:text-rose-500"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={14} />
                  Supprimer
                </button>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                className="btn-primary !px-3 !py-1.5 text-xs"
                onClick={() => setDupOpen((value) => !value)}
              >
                <Copy size={14} />
                Dupliquer & recycler
                <ChevronDown size={13} />
              </button>

              {dupOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Fermer le menu"
                    className="fixed inset-0 z-0 cursor-default"
                    onClick={() => setDupOpen(false)}
                  />
                  <div className="absolute bottom-full right-0 z-10 mb-2 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
                    <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Recycler vers une plateforme
                    </p>
                    {PLATFORMS.map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => handleDuplicate(platform)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink transition hover:bg-raised"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: PLATFORM_META[platform].color }}
                        />
                        <span className="flex-1">{platform}</span>
                        {platform === item.platform && (
                          <span className="text-[9px] uppercase tracking-wide text-muted">
                            actuel
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <p className="mt-2 text-[10px] text-muted">
            Sauvegarde automatique locale · statut : {item.status}
          </p>
        </footer>
      </aside>
    </div>
  );
}
