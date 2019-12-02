import Component from '@/app/graph/Component'
import Config from '@/app/util/Config'
import * as PIXI from 'pixi.js'
import Point from '@/app/util/Point'
const config = new Config()

abstract class Shape extends Component {
  protected width: number = config.spriteWidth
  protected height: number = config.spriteHeight
  protected radius: number = config.squareRadius
  protected interval: number = config.lineInterval

  protected x: number
  protected y: number

  protected constructor(
    stage: PIXI.Container,
    description: string,
    baseIndex: number,
    x: number,
    y: number
  ) {
    super(stage, description, baseIndex)
    this.x = x
    this.y = y
  }

  protected paint(): void {
    let text = new PIXI.Text(this.getDisplayText(), this.textStyle)
    text.x = this.x + this.getTextIndent()
    text.y = this.getTextY()
    text.zIndex = this.baseIndex + 1

    let gd = this.drawBorder(config.strokeColor, text.width)
    let ga = this.drawBorder(config.activeStrokeColor, text.width)
    ga.visible = false
    gd.zIndex = ga.zIndex = this.baseIndex

    this.spriteGroup = [text, gd, ga]
    for (let item of this.spriteGroup) {
      this.container.addChild(item)
    }
  }

  /* Tell whether the given point is contained in the component */
  public contain(p: Point): boolean {
    return (
      p.x >= this.x &&
      p.x <= this.x + this.width &&
      p.y >= this.y &&
      p.y <= this.y + this.height
    )
  }

  public move(deltaX: number, deltaY: number): void {
    this.x += deltaX
    this.y += deltaY
    for (let sprite of this.spriteGroup) {
      sprite.x += deltaX
      sprite.y += deltaY
    }
  }

  get center(): { x: number; y: number } {
    return {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2
    }
  }

  protected abstract drawBorder(color: number, textWidth: number): PIXI.Graphics

  protected abstract getTextIndent(): number

  protected getTextY(): number {
    return this.y + this.height / 2 - this.textStyle.fontSize * 1.25
  }
}

export default Shape
