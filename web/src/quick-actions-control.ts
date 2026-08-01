import { IControl } from 'maplibre-gl'
import { t } from 'i18next'
import { el } from 'redom'
import { LayerSwitcher } from '@russss/maplibregl-layer-switcher'
import VoltageFilterControl from './voltage-filter-control.ts'
import './quick-actions-control.css'

const allBackgroundIds = ['A', 'C', 'F', 'G', 'H', 'N']

const backgroundActions = [
  { id: 'A', label: 'OSM', titleKey: 'openstreetmap' },
  { id: 'H', label: 'Esri', titleKey: 'layers.esri-imagery' },
  { id: 'F', label: 'PNOA', titleKey: 'layers.pnoa-imagery' },
  { id: 'G', label: 'ICGC', titleKey: 'layers.icgc-imagery' }
]

const voltageActions = [400, 200, 132, 110, 66, 20]

export default class QuickActionsControl implements IControl {
  _map?: maplibregl.Map
  _container!: HTMLDivElement
  _backgroundButtons = new Map<string, HTMLButtonElement>()
  _voltageButtons = new Map<number, HTMLButtonElement>()
  _toggleButton!: HTMLButtonElement
  _panel!: HTMLDivElement
  _clearButton!: HTMLButtonElement
  _layerSwitcher: LayerSwitcher
  _voltageFilter: VoltageFilterControl

  constructor(layerSwitcher: LayerSwitcher, voltageFilter: VoltageFilterControl) {
    this._layerSwitcher = layerSwitcher
    this._voltageFilter = voltageFilter
  }

  onAdd(map: maplibregl.Map): HTMLElement {
    this._map = map

    this._toggleButton = el('button', {
      type: 'button',
      class: 'maplibregl-ctrl-icon quick-actions-toggle',
      title: t('quick-actions.title', 'Quick actions'),
      'aria-label': t('quick-actions.title', 'Quick actions'),
      'aria-controls': 'quick-actions-panel',
      'aria-expanded': 'false',
      onclick: () => this.setOpen(this._panel.hidden)
    })

    const backgroundButtons = backgroundActions.map((action) => {
      const button: HTMLButtonElement = el('button', action.label, {
        type: 'button',
        title: t(action.titleKey),
        onclick: () => this.selectBackground(action.id)
      })
      button.dataset.quickBackground = action.id
      this._backgroundButtons.set(action.id, button)
      return button
    })

    const voltageButtons = voltageActions.map((voltage) => {
      const label = `≥ ${voltage} kV`
      const button: HTMLButtonElement = el('button', label, {
        type: 'button',
        title: t('quick-actions.minimum-voltage', 'Minimum {{voltage}} kV', { voltage }),
        onclick: () => this.selectVoltage(voltage)
      })
      button.dataset.quickVoltage = voltage.toString()
      this._voltageButtons.set(voltage, button)
      return button
    })

    this._clearButton = el('button', t('quick-actions.clear-filters', 'Clear filters'), {
      type: 'button',
      class: 'quick-action-clear',
      onclick: () => this.selectVoltage(0)
    })
    this._clearButton.dataset.quickClear = ''

    const voltageFilterElement = this._voltageFilter.onAdd(map)

    this._panel = el(
      'div#quick-actions-panel',
      el('div.quick-actions-title', t('quick-actions.backgrounds', 'Backgrounds')),
      el('div.quick-actions-backgrounds', backgroundButtons),
      voltageFilterElement,
      el('div.quick-actions-voltages', voltageButtons),
      this._clearButton,
      {
        class: 'quick-actions-panel',
        hidden: true
      }
    )

    const trigger = el('div', this._toggleButton, {
      class: 'maplibregl-ctrl-group quick-actions-trigger'
    })

    this._container = el('div', trigger, this._panel, {
      class: 'maplibregl-ctrl quick-actions-control',
      onkeydown: this.handleKeydown
    })

    map.on('styledata', this.syncState)
    map.on('click', this.closePanel)
    this.syncState()
    return this._container
  }

  onRemove(): void {
    this._map?.off('styledata', this.syncState)
    this._map?.off('click', this.closePanel)
    this._voltageFilter.onRemove()
    this._container.remove()
    this._map = undefined
  }

  handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !this._panel.hidden) {
      this.setOpen(false)
      this._toggleButton.focus()
    }
  }

  closePanel = () => this.setOpen(false)

  setOpen(open: boolean) {
    this._panel.hidden = !open
    this._toggleButton.setAttribute('aria-expanded', open.toString())
  }

  selectBackground(backgroundId: string) {
    for (const id of allBackgroundIds) {
      this._layerSwitcher.setVisibility(id, id === backgroundId)
    }
    this.syncState()
  }

  selectVoltage(minimumVoltage: number) {
    this._voltageFilter.setMinimumVoltage(minimumVoltage, true)
    this.syncState()
  }

  syncState = () => {
    const activeBackground = backgroundActions.find((action) =>
      this._layerSwitcher._visible.includes(action.id)
    )?.id

    for (const [id, button] of this._backgroundButtons) {
      this.setActive(button, id === activeBackground)
    }

    for (const [voltage, button] of this._voltageButtons) {
      this.setActive(button, voltage === this._voltageFilter.minimumVoltage)
    }
    this.setActive(this._clearButton, this._voltageFilter.minimumVoltage === 0)

    const hasCustomSelection =
      (activeBackground !== undefined && activeBackground !== 'A') || this._voltageFilter.minimumVoltage > 0
    this._toggleButton.classList.toggle('has-selection', hasCustomSelection)
  }

  setActive(button: HTMLButtonElement, active: boolean) {
    button.classList.toggle('active', active)
    button.setAttribute('aria-pressed', active.toString())
  }
}
