import { useEffect, useState } from 'react';
import { BookOpen, Plus, Trash2, X } from 'lucide-react';
import { useToast } from './Toast';
import { readTemplates, templateFromItem, writeTemplates, type ContentTemplate } from '../lib/templates';
import type { PostItem } from '../types';

interface TemplateLibraryModalProps {
  items: PostItem[];
  onClose: () => void;
  onUse: (template: ContentTemplate) => void;
}

export default function TemplateLibraryModal({
  items,
  onClose,
  onUse,
}: TemplateLibraryModalProps) {
  const toast = useToast();
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [sourceId, setSourceId] = useState(items[0]?.id ?? '');
  const [name, setName] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    try {
      setTemplates(readTemplates());
    } catch (error) {
      console.error('[templates] lecture impossible', error);
      setLoadError('Impossible de lire la bibliothèque de modèles. Elle n’a pas été modifiée.');
    }
  }, []);

  const persist = (next: ContentTemplate[]) => {
    try {
      writeTemplates(next);
      setTemplates(next);
      setLoadError('');
      return true;
    } catch (error) {
      console.error('[templates] sauvegarde impossible', error);
      toast('La bibliothèque de modèles n’a pas pu être enregistrée.', 'error');
      return false;
    }
  };

  const addTemplate = () => {
    const source = items.find((item) => item.id === sourceId);
    const cleanedName = name.trim();
    if (!source || !cleanedName) return;
    if (templates.some((template) => template.name.toLocaleLowerCase() === cleanedName.toLocaleLowerCase())) {
      toast('Un modèle porte déjà ce nom.', 'error');
      return;
    }
    if (persist([...templates, templateFromItem(cleanedName, source)])) {
      setName('');
      toast('Modèle enregistré.');
    }
  };

  const removeTemplate = (id: string) => {
    persist(templates.filter((template) => template.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fermer les modèles"
        className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section className="card relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-accent" />
            <div>
              <h2 className="text-base font-bold">Modèles de contenu</h2>
              <p className="text-[11px] text-muted">Réutilisez vos formats, tags et checklists.</p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {loadError ? (
            <p role="alert" className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-xs text-rose-600">
              {loadError}
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-line bg-raised/40 p-3">
                <h3 className="text-xs font-semibold">Créer un modèle à partir d’un contenu</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    className="field min-w-[180px] flex-1"
                    value={name}
                    maxLength={60}
                    placeholder="Nom du modèle"
                    aria-label="Nom du modèle"
                    onChange={(event) => setName(event.target.value)}
                  />
                  <select
                    className="field min-w-[180px] flex-1"
                    value={sourceId}
                    onChange={(event) => setSourceId(event.target.value)}
                    aria-label="Contenu source du modèle"
                    disabled={items.length === 0}
                  >
                    {items.length === 0 ? (
                      <option value="">Aucun contenu disponible</option>
                    ) : (
                      items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title || 'Sans titre'} · {item.platform}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={addTemplate}
                    disabled={!name.trim() || !sourceId}
                  >
                    <Plus size={14} /> Enregistrer
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-muted">
                  La date et le statut ne sont pas copiés : chaque nouveau contenu repart du backlog.
                </p>
              </div>

              <div className="space-y-2">
                {templates.length === 0 && (
                  <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-xs text-muted">
                    Aucun modèle pour le moment.
                  </p>
                )}
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{template.name}</p>
                      <p className="truncate text-[11px] text-muted">
                        {template.platform} · {template.format} · {template.checklist.length} étape
                        {template.checklist.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button type="button" className="btn-primary !py-1.5 text-xs" onClick={() => onUse(template)}>
                      Utiliser
                    </button>
                    <button
                      type="button"
                      className="icon-btn hover:text-rose-500"
                      onClick={() => removeTemplate(template.id)}
                      title={`Supprimer le modèle ${template.name}`}
                      aria-label={`Supprimer le modèle ${template.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
