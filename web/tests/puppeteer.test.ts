import { describe, beforeAll, test, expect } from 'vitest'
import 'vitest-puppeteer'
import { minimumVoltageFilterForLayer } from '../src/voltage-filter'
import { LayerSpecification } from 'maplibre-gl'

const url = 'http://localhost:5173'

describe('Page load', () => {
  test('page loads without errors', async () => {
    const errors: Error[] = []

    page.on('pageerror', (error) => {
      errors.push(error)
    })

    page.on('error', (error) => {
      errors.push(error)
    })

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    })

    await page.waitForSelector('body')
    expect(errors.length).toBe(0)
  }, 30000)
})

describe('Page structure', () => {
  beforeAll(async () => {
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    })
  }, 30000)

  test('page has expected title', async () => {
    const title = await page.title()
    expect(title).toBe('Open Infrastructure Map')
  })

  test('page has expected structure', async () => {
    expect((await page.$('body')) !== null).toBe(true)
    const isPageInteractive = await page.evaluate(() => {
      return document.readyState === 'complete'
    })
    expect(isPageInteractive).toBe(true)
  })

  test('minimum voltage filter updates the map and URL', async () => {
    await page.waitForSelector('.quick-actions-toggle')
    await page.$eval('.quick-actions-toggle', (button) => (button as HTMLButtonElement).click())
    await page.waitForSelector('#minimum-voltage')
    expect(
      await page.$eval('#minimum-voltage', (input) => input.closest('#quick-actions-panel') !== null)
    ).toBe(true)
    await page.$eval('#minimum-voltage', (input) => {
      const voltageInput = input as HTMLInputElement
      voltageInput.value = '220'
      voltageInput.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await page.waitForFunction(() => window.location.hash.includes('/v=220'))

    const inputValue = await page.$eval('#minimum-voltage', (input) => (input as HTMLInputElement).value)
    expect(inputValue).toBe('220')
  })

  test('quick actions switch backgrounds and voltage filters', async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

    const click = (selector: string) =>
      page.$eval(selector, (button) => (button as HTMLButtonElement).click())

    await page.waitForSelector('.quick-actions-toggle')
    expect(
      await page.$eval(
        '.quick-actions-toggle',
        (button) => button.parentElement?.classList.contains('maplibregl-ctrl-group') ?? false
      )
    ).toBe(true)
    expect(await page.$eval('#quick-actions-panel', (panel) => (panel as HTMLDivElement).hidden)).toBe(
      true
    )
    await click('.quick-actions-toggle')
    expect(
      await page.$eval('.quick-actions-toggle', (button) => button.getAttribute('aria-expanded'))
    ).toBe('true')
    expect(await page.$eval('#quick-actions-panel', (panel) => (panel as HTMLDivElement).hidden)).toBe(
      false
    )

    await page.waitForSelector('[data-quick-background="H"]')
    await click('[data-quick-background="H"]')
    await page.waitForFunction(() => window.location.hash.split('/')[3]?.split(',').includes('H'), {
      timeout: 5000
    })

    expect(
      await page.$eval('[data-quick-background="H"]', (button) => button.getAttribute('aria-pressed'))
    ).toBe('true')

    await page.waitForSelector('[data-quick-background="G"]')
    await click('[data-quick-background="G"]')
    await page.waitForFunction(() => window.location.hash.split('/')[3]?.split(',').includes('G'), {
      timeout: 5000
    })

    expect(
      await page.$eval('[data-quick-background="G"]', (button) => button.getAttribute('aria-pressed'))
    ).toBe('true')

    await click('[data-quick-voltage="400"]')
    await page.waitForFunction(() => window.location.hash.includes('/v=400'), { timeout: 5000 })
    expect(await page.$eval('#minimum-voltage', (input) => (input as HTMLInputElement).value)).toBe('400')

    await click('[data-quick-voltage="66"]')
    await page.waitForFunction(() => window.location.hash.includes('/v=66'), { timeout: 5000 })
    expect(await page.$eval('#minimum-voltage', (input) => (input as HTMLInputElement).value)).toBe('66')

    await click('[data-quick-voltage="20"]')
    await page.waitForFunction(() => window.location.hash.includes('/v=20'), { timeout: 5000 })
    expect(await page.$eval('#minimum-voltage', (input) => (input as HTMLInputElement).value)).toBe('20')

    await click('[data-quick-clear]')
    await page.waitForFunction(() => !window.location.hash.includes('/v='), { timeout: 5000 })
    expect(await page.$eval('#minimum-voltage', (input) => (input as HTMLInputElement).value)).toBe('')

    await click('[data-quick-background="F"]')
    await page.waitForFunction(() => window.location.hash.split('/')[3]?.split(',').includes('F'), {
      timeout: 5000
    })
  }, 30000)

  test('line popup content renders without waiting for circuit details', async () => {
    const result = await page.evaluate(`(async () => {
      const { default: InfoPopup } = await import('/src/popup/infopopup.ts')
      const pendingRequest = new Promise(() => {})
      const infoPopup = new InfoPopup({
        layers: [],
        min_zoom: 0,
        api: { fetch: () => pendingRequest },
        circuit_inspector: {}
      })
      const content = infoPopup.popupHtml({
        layer: { id: 'power_line_1' },
        properties: { osm_id: 1, voltage: '400000' }
      })
      return {
        isElement: content instanceof HTMLElement,
        hasHeader: content.querySelector('.oim-popup-header') !== null,
        hasFooter: content.querySelector('.oim-info-footer') !== null
      }
    })()`)

    expect(result).toEqual({
      isElement: true,
      hasHeader: true,
      hasFooter: true
    })
  })

  test('relation-based substations use their positive member ID for circuit lookup', async () => {
    const requestedPath = await page.evaluate(`(async () => {
      const { default: InfoPopup } = await import('/src/popup/infopopup.ts')
      let path
      const infoPopup = new InfoPopup({
        layers: [],
        min_zoom: 0,
        api: {
          fetch: (requestedPath) => {
            path = requestedPath
            return Promise.resolve({ circuits: [] })
          }
        },
        circuit_inspector: {}
      })
      await infoPopup.fetch_substation_circuits('-11311505')
      return path
    })()`)

    expect(requestedPath).toBe('/api/substation/11311505')
  })
})

describe('Minimum voltage filter', () => {
  test.each([
    ['power_line_1', 'power_line', 'voltage'],
    ['power_line_underground_2', 'power_line', 'voltage_2'],
    ['power_line_underground_3', 'power_line', 'voltage_3'],
    ['power_substation', 'power_substation', 'voltage'],
    ['power_transformer', 'power_transformer', 'voltage_primary']
  ])('uses the correct voltage field for %s', (id, sourceLayer, voltageField) => {
    const layer = {
      id,
      type: 'line',
      source: 'power',
      'source-layer': sourceLayer
    } as LayerSpecification

    expect(minimumVoltageFilterForLayer(layer, 220)).toEqual([
      '>=',
      ['to-number', ['coalesce', ['get', voltageField], 0]],
      220
    ])
  })
})
