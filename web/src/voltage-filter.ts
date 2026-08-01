import { FilterSpecification, LayerSpecification } from 'maplibre-gl'

export function minimumVoltageFilterForLayer(
  layer: LayerSpecification,
  minimumVoltage: number
): FilterSpecification | undefined {
  if (!('source' in layer) || layer.source !== 'power' || !('source-layer' in layer)) {
    return
  }

  let voltageField: string | undefined
  if (layer['source-layer'] === 'power_line') {
    if (layer.id.endsWith('_2')) {
      voltageField = 'voltage_2'
    } else if (layer.id.endsWith('_3')) {
      voltageField = 'voltage_3'
    } else {
      voltageField = 'voltage'
    }
  } else if (
    layer['source-layer'] === 'power_substation' ||
    layer['source-layer'] === 'power_substation_point' ||
    layer['source-layer'] === 'power_compensator'
  ) {
    voltageField = 'voltage'
  } else if (layer['source-layer'] === 'power_transformer') {
    voltageField = 'voltage_primary'
  }

  if (!voltageField) return

  return ['>=', ['to-number', ['coalesce', ['get', voltageField], 0]], minimumVoltage]
}
