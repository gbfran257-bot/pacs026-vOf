import React, { useState, useEffect } from 'react';
import { ImageModal, FooterAction } from '@ohif/ui-next';
import { useTranslation } from 'react-i18next';
const MAX_TEXTURE_SIZE = 10000;
const DEFAULT_FILENAME = 'image';

type Cell = { id: string; label: string; thumb: string; isActive: boolean };

interface ViewportDownloadFormNewProps {
  onClose: () => void;
  defaultSize: number;
  fileTypeOptions: Array<{ value: string; label: string }>;
  viewportId: string;
  showAnnotations: boolean;
  onAnnotationsChange: (show: boolean) => void;
  dimensions: { width: number; height: number };
  onDimensionsChange: (dimensions: { width: number; height: number }) => void;
  onEnableViewport: (element: HTMLElement) => void;
  onDisableViewport: () => void;
  onDownload: (filename: string, fileType: string) => void;
  onPrint: () => Promise<void>;
  onGetCells: () => Cell[];
  onCombine: (
    ids: string[],
    opts: {
      action: 'save' | 'print';
      filename: string;
      fileType: string;
      cols: number;
      includeOverlay: boolean;
    }
  ) => Promise<void>;
  warningState: { enabled: boolean; value: string };
}

const TabButton = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1 text-sm border-b-2 ${
      active
        ? 'border-primary text-primary'
        : 'text-muted-foreground hover:text-foreground border-transparent'
    }`}
  >
    {children}
  </button>
);

function ViewportDownloadFormNew({
  onClose,
  defaultSize,
  fileTypeOptions,
  viewportId,
  showAnnotations,
  onAnnotationsChange,
  dimensions,
  warningState,
  onDimensionsChange,
  onEnableViewport,
  onDisableViewport,
  onDownload,
  onPrint,
  onGetCells,
  onCombine,
}: ViewportDownloadFormNewProps) {
  const [viewportElement, setViewportElement] = useState<HTMLElement | null>(null);
  const [showWarningMessage, setShowWarningMessage] = useState(true);
  const [filename, setFilename] = useState(DEFAULT_FILENAME);
  const [fileType, setFileType] = useState('jpg');
  const [tab, setTab] = useState<'single' | 'combined'>('single');
  const [cells, setCells] = useState<Cell[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cols, setCols] = useState(0);
  const [includeOverlay, setIncludeOverlay] = useState(true);
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation('CaptureViewportModal');

  useEffect(() => {
    if (!viewportElement) {
      return;
    }

    onEnableViewport(viewportElement);

    return () => {
      onDisableViewport();
    };
  }, [onDisableViewport, onEnableViewport, viewportElement]);

  // Cargar las celdas la primera vez que se abre la pestaña combinada
  useEffect(() => {
    if (tab === 'combined' && cells.length === 0) {
      const found = onGetCells();
      setCells(found);
      setSelected(new Set(found.map(c => c.id)));
    }
  }, [tab]);

  const toggleCell = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const runCombined = async (action: 'save' | 'print') => {
    const ids = cells.filter(c => selected.has(c.id)).map(c => c.id);
    if (!ids.length) {
      return;
    }
    setBusy(true);
    try {
      await onCombine(ids, {
        action,
        filename: filename || DEFAULT_FILENAME,
        fileType,
        cols,
        includeOverlay,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ImageModal>
      <ImageModal.Body>
        {/* El viewport de descarga SIEMPRE queda montado; en la pestaña combinada solo se oculta */}
        <div className={tab === 'single' ? 'contents' : 'h-0 overflow-hidden'}>
          <ImageModal.ImageVisual>
            <div
              style={{
                height: dimensions.height,
                width: dimensions.width,
                position: 'relative',
              }}
              data-viewport-uid={viewportId}
              ref={setViewportElement}
            >
              {warningState.enabled && showWarningMessage && (
                <div
                  className="text-foreground absolute left-1/2 bottom-[5px] z-[1000] -translate-x-1/2 whitespace-nowrap rounded bg-black p-3 text-xs font-bold"
                  style={{
                    fontSize: '12px',
                  }}
                >
                  {warningState.value}
                </div>
              )}
            </div>
          </ImageModal.ImageVisual>
        </div>

        {tab === 'combined' && (
          <div className="bg-background h-[420px] w-[640px] max-w-full overflow-auto rounded-lg p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {selected.size} de {cells.length} seleccionadas
              </span>
              <span className="space-x-3">
                <button
                  type="button"
                  className="text-primary"
                  onClick={() => setSelected(new Set(cells.map(c => c.id)))}
                >
                  Todas
                </button>
                <button type="button" className="text-primary" onClick={() => setSelected(new Set())}>
                  Ninguna
                </button>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {cells.map(c => (
                <label
                  key={c.id}
                  className={`relative cursor-pointer rounded border-2 bg-black ${
                    selected.has(c.id) ? 'border-primary' : 'border-transparent opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="absolute left-2 top-2 z-10 h-4 w-4"
                    checked={selected.has(c.id)}
                    onChange={() => toggleCell(c.id)}
                  />
                  {c.thumb ? (
                    <img
                      src={c.thumb}
                      className="h-32 w-full object-contain"
                    />
                  ) : (
                    <div className="h-32" />
                  )}
                  <div className="text-foreground px-2 py-1 text-xs">
                    {c.label}
                    {c.isActive ? ' (activa)' : ''}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <ImageModal.ImageOptions>
          <div className="mb-3 flex border-b border-white/10">
            <TabButton active={tab === 'single'} onClick={() => setTab('single')}>
              Imagen individual
            </TabButton>
            <TabButton active={tab === 'combined'} onClick={() => setTab('combined')}>
              Combinar / Imprimir
            </TabButton>
          </div>

          <div className="flex items-end space-x-2">
            <ImageModal.Filename
              value={filename}
              onChange={e => setFilename(e.target.value)}
            >
              {t('File name')}
            </ImageModal.Filename>
            <ImageModal.Filetype
              selected={fileType}
              onSelect={setFileType}
              options={fileTypeOptions}
            />
          </div>

          {tab === 'single' ? (
            <>
              <ImageModal.ImageSize
                width={dimensions.width.toString()}
                height={dimensions.height.toString()}
                onWidthChange={e => {
                  onDimensionsChange({
                    ...dimensions,
                    width: parseInt(e.target.value) || defaultSize,
                  });
                }}
                onHeightChange={e => {
                  onDimensionsChange({
                    ...dimensions,
                    height: parseInt(e.target.value) || defaultSize,
                  });
                }}
                maxWidth={MAX_TEXTURE_SIZE.toString()}
                maxHeight={MAX_TEXTURE_SIZE.toString()}
              >
                {t('Image size')} <span className="text-muted-foreground">px</span>
              </ImageModal.ImageSize>

              <ImageModal.SwitchOption
                defaultChecked={showAnnotations}
                checked={showAnnotations}
                onCheckedChange={onAnnotationsChange}
              >
                {t('Include annotations')}
              </ImageModal.SwitchOption>
              {warningState.enabled && (
                <ImageModal.SwitchOption
                  defaultChecked={showWarningMessage}
                  checked={showWarningMessage}
                  onCheckedChange={setShowWarningMessage}
                >
                  {t('Include warning message')}
                </ImageModal.SwitchOption>
              )}
              <FooterAction className="mt-2">
                <FooterAction.Right>
                  <FooterAction.Secondary onClick={onClose}>
                    {t('Common:Cancel')}
                  </FooterAction.Secondary>
                  <FooterAction.Secondary
                    onClick={async () => {
                      await onPrint();
                      onClose();
                    }}
                  >
                    Imprimir
                  </FooterAction.Secondary>
                  <FooterAction.Primary
                    onClick={() => {
                      onDownload(filename || DEFAULT_FILENAME, fileType);
                      onClose();
                    }}
                  >
                    {t('Common:Save')}
                  </FooterAction.Primary>
                </FooterAction.Right>
              </FooterAction>
            </>
          ) : (
            <>
              <div className="mt-3 flex items-center space-x-2 text-sm">
                <span className="text-muted-foreground">Columnas</span>
                <select
                  value={cols}
                  onChange={e => setCols(parseInt(e.target.value))}
                  className="bg-background text-foreground h-8 rounded px-2"
                >
                  <option value={0}>Auto</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
              <div className="mt-3">
                <ImageModal.SwitchOption
                  defaultChecked={includeOverlay}
                  checked={includeOverlay}
                  onCheckedChange={setIncludeOverlay}
                >
                  Incluir texto del visor
                </ImageModal.SwitchOption>
              </div>
              <FooterAction className="mt-2">
                <FooterAction.Right>
                  <FooterAction.Secondary onClick={onClose}>
                    {t('Common:Cancel')}
                  </FooterAction.Secondary>
                  <FooterAction.Secondary
                    disabled={busy || selected.size === 0}
                    onClick={() => runCombined('print')}
                  >
                    Imprimir
                  </FooterAction.Secondary>
                  <FooterAction.Primary
                    disabled={busy || selected.size === 0}
                    onClick={() => runCombined('save')}
                  >
                    {t('Common:Save')}
                  </FooterAction.Primary>
                </FooterAction.Right>
              </FooterAction>
            </>
          )}
        </ImageModal.ImageOptions>
      </ImageModal.Body>
    </ImageModal>
  );
}

export default {
  'ohif.captureViewportModal': ViewportDownloadFormNew,
};
