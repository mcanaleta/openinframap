import { Map, StyleImageMetadata } from 'maplibre-gl'
import { manifest } from 'virtual:render-svg'

export class SymbolLoader {
  icon_ratio: number
  icons: Record<string, string>

  constructor(private map: Map) {
    this.icon_ratio = Math.min(Math.round(window.devicePixelRatio), 2)
    this.icons = manifest[this.icon_ratio.toString()]
    this.map.setMissingStyleImageResolver((id) => this.loadIcon(id))
  }

  async loadIcon(id: string) {
    const image_url = this.icons[id]
    const metadata: StyleImageMetadata = {
      pixelRatio: this.icon_ratio,
      sdf: false
    }

    if (!image_url) {
      console.error(`Icon not found: ${id}`)
      return
    }

    const image = await this.map.loadImage(image_url)
    this.map.addImage(id, image.data, metadata)
  }
}
