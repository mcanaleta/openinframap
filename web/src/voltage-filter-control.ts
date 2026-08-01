import { IControl, FilterSpecification } from 'maplibre-gl'
import { t } from 'i18next'
import { el } from 'redom'
import { URLHash } from '@russss/maplibregl-layer-switcher'
import { minimumVoltageFilterForLayer } from './voltage-filter.ts'
import './voltage-filter-control.css'

const maximumVoltage = 1200

function parseMinimumVoltage(value: string | null): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.min(parsed, maximumVoltage)
}

export default class VoltageFilterControl implements IControl {
  _map?: maplibregl.Map
  _container!: HTMLDivElement
  _input!: HTMLInputElement
  _minimumVoltage = 0
  _originalFilters = new Map<string, FilterSpecification | undefined>()
  _urlHash: URLHash

  constructor(urlHash: URLHash) {
    this._urlHash = urlHash
    urlHash.registerHandler('v', (value) => {
      this.setMinimumVoltage(parseMinimumVoltage(value))
    })
  }

  onAdd(map: maplibregl.Map): HTMLElement {
    this._map = map

    const inputId = 'minimum-voltage'
    this._input = el('input', {
      id: inputId,
      type: 'number',
      min: 0,
      max: maximumVoltage,
      step: 'any',
      inputMode: 'decimal',
      value: this._minimumVoltage || '',
      placeholder: '0',
      ariaLabel: t('filters.minimum-voltage', 'Minimum voltage'),
      oninput: () => this.handleInput()
    })

    this._container = el(
      'div',
      el('label', t('filters.minimum-voltage', 'Minimum voltage'), { for: inputId }),
      el('div.voltage-filter-input', '≥', this._input, el('span', 'kV')),
      {
        class: 'voltage-filter-control'
      }
    )

    if (map.isStyleLoaded()) {
      this.applyFilter()
    } else {
      map.on('load', this.applyFilter)
    }

    return this._container
  }

  onRemove(): void {
    this._map?.off('load', this.applyFilter)
    this._container.remove()
    this._map = undefined
    this._originalFilters.clear()
  }

  handleInput() {
    const minimumVoltage = parseMinimumVoltage(this._input.value)
    this.setMinimumVoltage(minimumVoltage, true)
  }

  get minimumVoltage() {
    return this._minimumVoltage
  }

  setMinimumVoltage(minimumVoltage: number, updateHash = false) {
    this._minimumVoltage = parseMinimumVoltage(minimumVoltage.toString())
    if (this._input) {
      this._input.value = this._minimumVoltage > 0 ? this._minimumVoltage.toString() : ''
    }
    this.applyFilter()
    if (updateHash) {
      this._urlHash.setParameter('v', this._minimumVoltage > 0 ? this._minimumVoltage.toString() : null)
    }
  }

  applyFilter = () => {
    if (!this._map?.isStyleLoaded()) return

    for (const layer of this._map.getStyle().layers) {
      const minimumVoltageFilter = minimumVoltageFilterForLayer(layer, this._minimumVoltage)
      if (!minimumVoltageFilter) continue

      if (!this._originalFilters.has(layer.id)) {
        this._originalFilters.set(layer.id, this._map.getFilter(layer.id))
      }

      const originalFilter = this._originalFilters.get(layer.id)
      if (this._minimumVoltage === 0) {
        this._map.setFilter(layer.id, originalFilter)
        continue
      }

      this._map.setFilter(
        layer.id,
        originalFilter
          ? (['all', originalFilter, minimumVoltageFilter] as FilterSpecification)
          : minimumVoltageFilter
      )
    }
  }
}
