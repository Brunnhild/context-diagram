import * as PIXI from 'pixi.js'
import Component from '@/app/graph/Component'
import Machine from '@/app/graph/shape/Machine'
import Hammer from 'hammerjs'
import { Vue } from 'vue/types/vue'
import Config from '@/app/util/Config'
import { Domain } from '@/app/graph/shape/Domain'
import Shape from '@/app/graph/shape/Shape'
import Requirement from '@/app/graph/shape/Requirement'
import { InterfaceLine } from '@/app/graph/line/InterfaceLine'
import Reference from '@/app/graph/line/Reference'
import Constraint from '@/app/graph/line/Constraint'
import { Line } from '@/app/graph/line/Line'
import { Phenomenon } from '@/app/graph/Phenomenon'

const config = new Config()

class Canvas {
  private app: PIXI.Application = null

  private width: number = 700
  private height: number = 450

  private draggingComponent: Shape = null
  private editingComponent: Component = null
  private drawingLine: Line = null
  // record the last delta value
  private lastDeltaX = 0
  private lastDeltaY = 0

  // It should never be set in this class, for it's to be set in Vue instance
  public activePen: number = -1
  public _Vue: Vue = null

  private readonly componentsList: Array<Component> = []
  public componentsCount: number = 0

  public machine: Machine = null
  public domainList: Array<Domain> = []
  public domainCount: number = 0
  public requirement: Requirement = null

  public interfaceList: Array<InterfaceLine> = []
  public interfaceCount: number = 0
  public referenceList: Array<Reference> = []
  public referenceCount: number = 0
  public constraintList: Array<Constraint> = []
  public constraintCount: number = 0

  private static instance: Canvas

  public static init(vue: Vue): void {
    Canvas.instance = new Canvas(vue)
  }

  public static destroy(): void {
    Canvas.instance = null
  }

  public static load(vue: Vue, r: any): Canvas {
    let c = (Canvas.instance = new Canvas(vue))
    c.componentsCount = r.componentsCount
    c.domainCount = r.domainCount
    c.interfaceCount = r.interfaceCount
    c.referenceCount = r.referenceCount
    c.constraintCount = r.constraintCount
    let m = r.machine
    let machine = new Machine(
      c.app.stage,
      m.x,
      m.y,
      m.description,
      m.shortName,
      m.baseIndex
    )
    c.machine = machine
    c.componentsList.push(machine)
    for (let item of r.domainList) {
      let domain = new Domain(
        c.app.stage,
        item.x,
        item.y,
        item.description,
        item.shortName,
        item.baseIndex,
        item.physicalProperty,
        item.domainType
      )
      c.domainList.push(domain)
      c.componentsList.push(domain)
    }
    let requirement = new Requirement(
      c.app.stage,
      m.x,
      m.y,
      m.description,
      m.baseIndex
    )
    c.requirement = requirement
    c.componentsList.push(requirement)
    for (let item of r.interfaceList) {
      let initiator = c.findShape(item.initiator)
      let receiver = c.findShape(item.receiver)
      let interfaceLine = new InterfaceLine(
        c.app.stage,
        item.description,
        item.baseIndex,
        initiator,
        receiver
      )
      initiator.attachedLines.push(interfaceLine)
      receiver.attachedLines.push(interfaceLine)
      for (let itt of item.phenomenonList) {
        interfaceLine.phenomenonList.push(Phenomenon.getPhenomenon(itt.name))
      }
      c.interfaceList.push(interfaceLine)
      c.componentsList.push(interfaceLine)
    }
    for (let item of r.referenceList) {
      let initiator = c.findShape(item.initiator)
      let receiver = c.findShape(item.receiver)
      let reference = new Reference(
        c.app.stage,
        item.description,
        item.baseIndex,
        initiator,
        receiver
      )
      initiator.attachedLines.push(reference)
      receiver.attachedLines.push(reference)
      for (let itt of item.phenomenonList) {
        reference.phenomenonList.push(Phenomenon.getPhenomenon(itt.name))
      }
      c.referenceList.push(reference)
      c.componentsList.push(reference)
    }
    for (let item of r.constraintList) {
      let initiator = c.findShape(item.initiator)
      let receiver = c.findShape(item.receiver)
      let constraint = new Constraint(
        c.app.stage,
        item.description,
        item.baseIndex,
        initiator,
        receiver
      )
      initiator.attachedLines.push(constraint)
      receiver.attachedLines.push(constraint)
      for (let itt of item.phenomenonList) {
        constraint.phenomenonList.push(Phenomenon.getPhenomenon(itt.name))
      }
      c.constraintList.push(constraint)
      c.componentsList.push(constraint)
    }
    return c
  }

  public findShape(description: string): Shape {
    for (let item of this.componentsList) {
      if (item.description === description && item instanceof Shape) return item
    }
  }

  public exportImage(): void {
    const image = this.app.renderer.plugins.extract.image(this.app.stage)
    image.onload = e => {
      let tmp = document.createElement('a')
      // @ts-ignore
      tmp.href = e.path[0].src
      tmp.download = 'img.png'
      tmp.click()
    }
  }

  constructor(vue?: Vue) {
    if (Canvas.instance) return Canvas.instance
    if (vue) this._Vue = vue

    this.app = new PIXI.Application({
      width: this.width,
      height: this.height,
      antialias: true,
      transparent: false,
      resolution: window.devicePixelRatio
    })

    this.app.renderer.backgroundColor = 0xffffff
    this.app.stage.sortableChildren = true

    let element = document.getElementById('canvas')
    if (element) {
      element.appendChild(this.app.view)
      /* Handle the HiDPI problem by setting the resolution of the PIXI Application and set the css size here */
      this.app.view.style.width = this.width.toString() + 'px'
      this.app.view.style.height = this.height.toString() + 'px'

      let hammertime = new Hammer(this.app.view)
      hammertime.get('pan').set({ direction: Hammer.DIRECTION_ALL })
      hammertime.on('tap', this.tapHandler.bind(this))
      hammertime.on('pan panstart panend', this.panHandler.bind(this))
      hammertime.on('doubletap', this.doubleTapHandler.bind(this))
    }
  }

  public deleteElement(c?: Component): void {
    let d: Component = null
    if (c) {
      d = c
    } else {
      for (let item of this.componentsList) {
        if (item.isActive) d = item
      }
    }
    if (d) {
      let lines = d.destroy()
      if (lines) {
        for (let item of lines) this.deleteElement(item)
      }
      this.removeComponent(d, this.componentsList)
      if (d instanceof Machine) {
        this.machine = null
      } else if (d instanceof Domain) {
        this.removeComponent(d, this.domainList)
      } else if (d instanceof Requirement) {
        this.requirement = null
      } else if (d instanceof InterfaceLine) {
        this.removeComponent(d, this.interfaceList)
      } else if (d instanceof Reference) {
        this.removeComponent(d, this.referenceList)
      } else if (d instanceof Constraint) {
        this.removeComponent(d, this.constraintList)
      }
    }
  }

  private removeComponent(c: Component, list: Array<Component>): void {
    let i = -1
    list.forEach((item, index) => {
      if (item === c) i = index
    })
    if (i !== -1) list.splice(i, 1)
  }

  private tapHandler(e: HammerInput): void {
    // For now, we simply add a rectangle to the canvas.
    if ('layerX' in e.srcEvent && 'layerY' in e.srcEvent) {
      switch (this.activePen) {
        case 0:
          if (this.machine) {
            this._Vue.$emit('giveWarn', 'There can exist only one machine. ')
            return
          }
          let machine = new Machine(
            this.app.stage,
            e.srcEvent.layerX,
            e.srcEvent.layerY,
            config.defaultMachineName,
            config.defaultMachineShortName,
            this.componentsCount * config.layerGap
          )
          this.machine = machine
          this.componentsList.push(machine)
          this.componentsCount++
          break
        case 1:
          let domain = new Domain(
            this.app.stage,
            e.srcEvent.layerX,
            e.srcEvent.layerY,
            config.defaultDomainName + (this.domainCount + 1),
            config.defaultDomainShortName + (this.domainCount + 1),
            this.componentsCount * config.layerGap
          )
          this.domainList.push(domain)
          this.domainCount++
          this.componentsList.push(domain)
          this.componentsCount++
          break
        case 2:
          if (this.requirement) {
            this._Vue.$emit(
              'giveWarn',
              'There can exist only one requirement. '
            )
            return
          }
          let requirement = new Requirement(
            this.app.stage,
            e.srcEvent.layerX,
            e.srcEvent.layerY,
            config.defaultRequirementName,
            this.componentsCount * config.layerGap
          )
          this.requirement = requirement
          this.componentsList.push(requirement)
          this.componentsCount++
          break
        case undefined:
          // eslint-disable-next-line no-case-declarations
          let comp = this.hit(e.srcEvent.layerX, e.srcEvent.layerY)
          if (comp) {
            for (let item of this.componentsList) {
              if (item === comp) comp.activate()
              else item.deactivate()
            }
          } else {
            for (let item of this.componentsList) {
              item.deactivate()
            }
          }
          break
      }
      this._Vue.$data['activePen'] = undefined
    }
  }

  private panHandler(e: HammerInput): void {
    if (!('layerX' in e.srcEvent && 'layerY' in e.srcEvent)) return
    switch (e.type) {
      case 'panstart':
        let comp = this.hit(e.srcEvent.layerX, e.srcEvent.layerY)
        if (!comp) return
        if (!(comp instanceof Shape)) return
        switch (this.activePen) {
          case 3:
            this.drawingLine = new InterfaceLine(
              this.app.stage,
              config.defaultInterfaceName + (this.interfaceCount + 1),
              (this.componentsCount + 1) * 10,
              comp
            )
            break
          case 4:
            this.drawingLine = new Reference(
              this.app.stage,
              config.defaultReferenceName + (this.referenceCount + 1),
              (this.componentsCount + 1) * 10,
              comp
            )
            break
          case 5:
            this.drawingLine = new Constraint(
              this.app.stage,
              config.defaultConstraintName + (this.constraintCount + 1),
              (this.componentsCount + 1) * 10,
              comp
            )
            break
          default:
            this.draggingComponent = comp
            break
        }
        break
      case 'pan':
        if (this.draggingComponent) {
          this.draggingComponent.move(
            e.deltaX - this.lastDeltaX,
            e.deltaY - this.lastDeltaY
          )
          this.lastDeltaX = e.deltaX
          this.lastDeltaY = e.deltaY
        }
        if (this.drawingLine) {
          let p = { x: e.srcEvent.layerX, y: e.srcEvent.layerY }
          if (!this.drawingLine.selfContain(p)) {
            let hover = this.hit(e.srcEvent.layerX, e.srcEvent.layerY)
            if (hover instanceof Shape) this.drawingLine.attach(hover)
            else this.drawingLine.lengthen(p)
          }
        }
        break
      case 'panend':
        this.draggingComponent = null
        this.lastDeltaX = 0
        this.lastDeltaY = 0
        if (this.drawingLine) {
          if (this.drawingLine.attached) {
            this.drawingLine.mount()
            this.componentsList.push(this.drawingLine)
            this.componentsCount++
            if (this.drawingLine instanceof InterfaceLine) {
              this.interfaceList.push(this.drawingLine)
              this.interfaceCount++
            } else if (this.drawingLine instanceof Reference) {
              this.referenceList.push(this.drawingLine)
              this.referenceCount++
            } else if (this.drawingLine instanceof Constraint) {
              this.constraintList.push(this.drawingLine)
              this.constraintCount++
            }
          } else {
            this.drawingLine.destroy()
          }
          this.drawingLine = null
        }
        this._Vue.$data['activePen'] = undefined
        break
    }
  }

  private doubleTapHandler(e: HammerInput): void {
    if (!('layerX' in e.srcEvent && 'layerY' in e.srcEvent)) return
    let comp = this.hit(e.srcEvent.layerX, e.srcEvent.layerY)
    if (comp) {
      this.editingComponent = comp
      if (comp instanceof Machine) {
        this._Vue.$emit('editMachine', <Machine>comp)
      } else if (comp instanceof Domain) {
        this._Vue.$emit('editDomain', <Domain>comp)
      } else if (comp instanceof Requirement) {
        this._Vue.$emit('editRequirement', <Requirement>comp)
      } else if (comp instanceof InterfaceLine) {
        this._Vue.$emit('edit-line', <InterfaceLine>comp)
      } else if (comp instanceof Reference) {
        this._Vue.$emit('edit-line', <Reference>comp)
      } else if (comp instanceof Constraint) {
        this._Vue.$emit('edit-line', <Constraint>comp)
      }
    }
  }

  /**
   * Given the tap point, tell the component tapped
   * @return The component tapped or null if no component tapped
   */
  private hit(x: number, y: number): Component | null {
    for (let comp of this.componentsList.reverse()) {
      if (comp.contain({ x, y })) {
        this.componentsList.reverse()
        return comp
      }
    }

    this.componentsList.reverse()
    return null
  }
}

export default Canvas
