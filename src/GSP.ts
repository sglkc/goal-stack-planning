export type GSPStateObject = {
  table: string[][],
  arm: string | null | undefined
}

type GSPCondition = typeof GSP.CONDITIONS[number]
type GSPOperator = typeof GSP.OPERATORS[number]
type GSPPADType = Record<
  GSPOperator,
  Record<'P' | 'A' | 'D', string[]>
>

export type GSPSolveOptions = {
  draw?: boolean
  logging?: boolean
}

export type GSPIterationReturn = void | {
  op: 'push' | 'pop'
  object: 'stack' | 'queue' | 'state'
  element: string
}

export default class GSP {
  // Konstanta kondisi pada stack
  static CONDITIONS = ['CLEAR', 'ON', 'ONTABLE', 'HOLDING', 'ARMEMPTY'] as const
  static OPERATORS = ['STACK', 'UNSTACK', 'PICKUP', 'PUTDOWN'] as const
  static PAD: GSPPADType = {
    STACK: {
      P: ['CLEAR(2)', 'HOLDING(1)'],
      A: ['ON(1,2)', 'CLEAR(1)', 'ARMEMPTY'],
      D: ['CLEAR(2)', 'HOLDING(1)']
    },
    UNSTACK: {
      P: ['ON(1,2)', 'CLEAR(1)', 'ARMEMPTY'],
      A: ['CLEAR(2)', 'HOLDING(1)'],
      D: ['ON(1,2)', 'CLEAR(1)', 'ARMEMPTY']
    },
    PICKUP: {
      P: ['ONTABLE(1)', 'CLEAR(1)', 'ARMEMPTY'],
      A: ['HOLDING(1)'],
      D: ['ONTABLE(1)', 'CLEAR(1)', 'ARMEMPTY']
    },
    PUTDOWN: {
      P: ['HOLDING(1)'],
      A: ['ONTABLE(1)', 'CLEAR(1)', 'ARMEMPTY'],
      D: ['HOLDING(1)']
    },
  }

  // Progress menyelesaian
  _state: string[][] = []
  _stack: string[] = []
  _queue: string[] = []

  // Atribut yang bisa diubah user
  maxIterations: number = 36
  initial: GSPStateObject
  goal: GSPStateObject

  // Digunakan untuk menginisialisasi new GSP(initial, goal, 10)
  constructor(initial: GSPStateObject, goal: GSPStateObject, maxIterations = 36) {
    this.maxIterations = maxIterations
    this.initial = Object.assign({}, initial)
    this.goal = Object.assign({}, goal)
    this.validateStates()
  }

  // Method static private utk validasi objek state sebelum diproses
  static validateStateObject(state: GSPStateObject, name = 'state'): Set<string> {
    const blocks = new Set<string>()

    if (typeof state !== 'object') throw new Error(`${name} harus berupa object`)
    if (!Array.isArray(state.table)) throw new Error(`${name}.table harus berupa array`)
    if (!(typeof state.arm === 'string' || [null, undefined].includes(state.arm))) {
      throw new Error(`${name}.arm harus berupa string, null, atau undefined`)
    }

    state.table.forEach((stack) => {
      stack.forEach((block) => {
        if (blocks.has(block)) throw new Error(`${name} block ${block} ada duplikat`)
        blocks.add(block)
      })
    })

    if (typeof state.arm === 'string') {
      if (blocks.has(state.arm)) throw new Error(`${name} block ${state.arm} ada di table dan arm`)
      blocks.add(state.arm)
    }

    return blocks
  }

  // Print objek state ke console dengan ilustrasi
  static printStateObject(state: GSPStateObject, name?: string): void {
    this.validateStateObject(state)
    const scene = []
    let height = 0

    if (name) console.log('%c' + name, 'color: white; font-weight: bold; font-size: 1rem;')

    scene.push('ARM: ' + (state.arm ?? 'KOSONG'), '')

    // Cari tumpukan dengan block terbanyak (tertinggi)
    state.table.forEach(({ length }) =>
      height = (length > height) ? length : height
    )

    // Gambar block di setiap tumpukan di tingkatan yang sama
    for (height; height > 0; height--) {
      const i = height - 1
      const level = state.table.map((t) => t[i] ? `| ${t[i]} |` : undefined).filter((t) => t)

      scene.push(level.join(' '))
    }

    // Buat tanah dan print ke console
    scene.push(`-`.repeat(6 * state.table.length - 1))
    console.log('%c' + scene.join('\n'), 'font-size: 0.8rem')
  }

  // Cek jika initial state dan goal state tidak valid
  validateStates() {
    const initialBlocks = GSP.validateStateObject(this.initial, 'this.initial')
    const goalBlocks = GSP.validateStateObject(this.goal, 'this.goal')

    if (initialBlocks.size !== goalBlocks.size) {
      throw new Error('initial state dan goal state memiliki block yang berbeda')
    }

    initialBlocks.forEach((block) => {
      if (!goalBlocks.has(block)) {
        throw new Error('initial state dan goal state memiliki block yang berbeda')
      }
    })
  }

  // Generate array kondisi dari objek state
  static generateStateConditions(state: GSPStateObject): string[] {
    const conditions: string[] = []

    state.table.forEach((stack) => {

      // Reverse array karena data struktur stack dimulai dari akhir
      const reversedStack = Array.from(stack).reverse()

      reversedStack.forEach((block, blockIndex) => {
        if (blockIndex === reversedStack.length - 1) {
          return conditions.push(`ONTABLE(${block})`)
        }

        const nextBlock = reversedStack.at(blockIndex + 1)
        conditions.push(`ON(${block},${nextBlock})`)

        if (blockIndex === 0) conditions.push(`CLEAR(${block})`)
      })
    })

    if (state.arm) conditions.push(`HOLDING(${state.arm})`)
    else conditions.push(`ARMEMPTY`)

    return conditions
  }

  // Membuat state object dari state array string
  static generateStateObject(states: string[]): GSPStateObject {
    const stacks: Set<string[]> = new Set()
    const sorted = states.sort((a, b) => a.localeCompare(b))
    const object: GSPStateObject = {
      arm: null,
      table: []
    }

    sorted.forEach((state) => {
      const [operator, A, B] = state.match(/\w+/ig) as RegExpMatchArray

      switch (operator) {
        case 'ARMEMPTY': break
        case 'HOLDING':
          object.arm = A
          break
        case 'ONTABLE':
          object.table.push([A])
          break
        case 'ON':
          stacks.add([A, B])
          break
      }
    })

    while (stacks.size) {
      stacks.forEach((stack) => {
        const [A, B] = stack
        const found = object.table.find((tb) => tb.at(-1) === B)

        if (found) {
          found.push(A)
          stacks.delete(stack)
        }
      })
    }

    return object
  }

  // Membuat state object dari state saat ini
  getCurrentStateObject(): GSPStateObject {
    const currentState = this._state.at(-1)
    return currentState ? GSP.generateStateObject(currentState) : this.initial
  }

  getBlockFromStates(
    states: string[],
    condition: GSPCondition,
    [A, B]: Array<string | undefined>
  ): Array<string | undefined> {
    const matcher = A
      ? `${condition}\\(${A}`
      : B
        ? `${condition}\\(.+,${B}\\)`
        : `${condition}`

    const regexp = new RegExp(matcher, 'i')
    const stateMatch = states.find((state) => state.match(regexp))

    if (!stateMatch) return []

    const [, a, b] = stateMatch.match(/\w+/ig) as RegExpMatchArray

    return [a, b]
  }

  applyPAD(
    pad: 'P' | 'A' | 'D' | 'AD',
    states: typeof this._state[number],
    operator: GSPOperator,
    [A, B]: string[],
  ): string[] {

    const newState = Array.from(states)

    if (pad === 'AD') {
      const addedStates = this.applyPAD('A', states, operator, [A, B])
      const finalStates = this.applyPAD('D', addedStates, operator, [A, B])

      this._state.push(finalStates)
      return []
    }

    const conditions = GSP.PAD[operator][pad].map((condition) => {
      return condition.replace('1', A).replace('2', B)
    })

    switch (pad) {
      case 'P':
        const nextOperand = B ? `,${B}` : ''

        this._stack.push(`${operator}(${A}${nextOperand})`)
        this._stack.push(conditions.join(' ^ '))
        conditions.forEach((condition) => this._stack.push(condition))

        return []
      case 'A':
        conditions.forEach((condition) => newState.push(condition))
        return newState
      case 'D':
        conditions.forEach((condition) => {
          newState.splice(newState.indexOf(condition), 1)
        })
        return newState
    }
  }

  // Print STATE, STACK, dan QUEUE saat ini
  printCurrentIteration(): void {
    const colorizer = 'color: white; background-color: royalblue; font-size: 1rem'
    const stack = Array.from(this._stack)
      .reverse()
      .map((item, i, { length }) => `${length - i}) ${item}`)
      .join('\n')
      .trim()

    console.log(
      `%cSTACK`, colorizer,
      '\n' + (this._stack.length ? stack : '> STACK KOSONG')
    )

    const state = this._state
      .map((item) => item.sort((a, b) => b.localeCompare(a)))
      .map((item, i) => `${i}) ` + item.join(' ^ '))
      .join('\n')
      .trim()

    console.log(
      `%cSTATE`, colorizer,
      '\n' + (this._state.length ? state : '> STATE KOSONG')
    )

    const queue = this._queue
      .map((item, i) => `${i + 1}) ${item}`)
      .join('\n')
      .trim()

    console.log(
      `%cQUEUE`, colorizer,
      '\n' + (this._queue.length ? queue : '> QUEUE KOSONG')
    )
  }

  // Reset state, stack, queue dan masukkan state dan stack dari user
  prepare(): void {
    this.validateStates()

    const initialConditions = GSP.generateStateConditions(this.initial)
    const goalConditions = GSP.generateStateConditions(this.goal)

    this._state = []
    this._stack = []
    this._queue = []
    this._state.push(initialConditions)
    this._stack.push(goalConditions.join(' ^ '))
    this._stack.push(...goalConditions)
  }

  // Lanjutkan penyelesaian ke iterasi selanjutnya
  solveNextIteration(options: GSPSolveOptions = {}): GSPIterationReturn {
    const currentSlot = this._stack.at(-1)
    const nextSlot = this._stack.at(-2) ?? ''
    const currentState = this._state.at(-1)

    if (!currentState) throw new Error('state kosong, panggil prepare() dahulu')
    if (!currentSlot) throw new Error('stack kosong, tidak dapat melanjutkan')

    const [slotName, A, B] = currentSlot.match(/\w+/ig) as RegExpMatchArray
    const nextSlotMatches = nextSlot.match(/\w+/ig)

    if (options.draw && options.logging) GSP.printStateObject(this.getCurrentStateObject())
    if (options.logging) this.printCurrentIteration()

    // Jika slot saat ini terpenuhi oleh state saat ini dan slot dibawahnya
    // bukan operator, maka pop dari stack
    // Referensi PDF Planning GSP CP: Langkah 3 Kondisi 1
    if (currentState.includes(currentSlot) && nextSlotMatches) {
      const nextSlotName = nextSlotMatches[0] as GSPOperator

      if (!GSP.OPERATORS.includes(nextSlotName)) return {
        op: 'pop',
        object: 'stack',
        element: this._stack.pop()!
      }
    }

    // Jika state saat ini terdapat slot saat ini, maka pop dari stack
    // Jika queue teratas tidak terdapat slot saat ini, maka masukkan
    // Referensi PDF Planning GSP CP: Langkah 3 Kondisi 4
    if (GSP.OPERATORS.includes(slotName as GSPOperator)) {
      const operation = this._stack.pop() as string
      const [operator] = operation.match(/\w+/ig) as RegExpMatchArray

      if (this._queue.at(-1) !== operation) {
        this._queue.push(operation)
        this.applyPAD('AD', currentState, operator as GSPOperator, [A, B])

        if (options.draw && !options.logging) GSP.printStateObject(this.getCurrentStateObject())

        return {
          op: 'push',
          object: 'queue',
          element: operation
        }
      }

      return
    }

    // Jika slot berisi kondisi atau rangkaian kondisi dan berada di atas slot
    // yang berisi operator, maka pop slot teratas dari stack dan pop slot
    // selanjutnya dan masukkan ke queue, dan update current-state
    // Referensi PDF Planning GSP CP: Langkah 3 Kondisi 3
    const nextSlotName = nextSlotMatches?.[0] as GSPOperator
    if (currentSlot.includes('^') || (slotName === 'HOLDING' && GSP.OPERATORS.includes(nextSlotName))) {
      const slotConditions = currentSlot.split(' ^ ')
      const conflict = slotConditions.find((op) => !currentState.includes(op))
      const popped = this._stack.pop()!

      if (conflict) {
        this._stack.push(conflict)
        return {
          op: 'push',
          object: 'stack',
          element: conflict
        }
      }

      if (!this._stack.length) return {
        op: 'push',
        object: 'stack',
        element: popped
      }

      if (GSP.OPERATORS.includes(nextSlotName)) {
        const operation = this._stack.pop() as string
        const [operator, A, B] = operation.match(/\w+/ig) as RegExpMatchArray

        this._queue.push(operation)
        this.applyPAD('AD', currentState, operator as GSPOperator, [A, B])

        if (options.draw && !options.logging) GSP.printStateObject(this.getCurrentStateObject())

        return {
          op: 'push',
          object: 'stack',
          element: operation
        }
      }
    }

    // Jika nama slot adalah suatu kondisi (ON, ONTABLE, ...) maka tambah
    // operator (STACK, PICKUP, ...) dan PRECONDITION untuk operator tersebut
    // Referensi PDF Planning GSP CP: Langkah 3 Kondisi 2
    if (GSP.CONDITIONS.includes(slotName as GSPCondition)) {
      const applyPreconditions = (operator: GSPOperator, blocks: string[]) =>
        this.applyPAD('P', currentState, operator, blocks)

      const element = this._stack.pop()!

      switch (slotName) {
        case 'CLEAR': {
          const [newA] = this.getBlockFromStates(currentState, 'ON', [, A])
          if (newA) {
            applyPreconditions('UNSTACK', [newA, A])
          } else {
            applyPreconditions('PICKUP', [A])
          }
        } break
        case 'ON': {
          if (currentState.includes(`HOLDING`)) {
            applyPreconditions('PUTDOWN', [A])
          } else {
            applyPreconditions('STACK', [A, B])
          }
        } break
        case 'ONTABLE': {
          applyPreconditions('PUTDOWN', [A])
        } break
        case 'HOLDING': {
          const [, newB] = this.getBlockFromStates(currentState, 'ON', [A])

          if (currentState.includes(`ONTABLE(${A})`)) {
            applyPreconditions('PICKUP', [A])
          } else if (newB) {
            applyPreconditions('UNSTACK', [A, newB])
          } else {
            applyPreconditions('PUTDOWN', [A])
          }
        } break
        case 'ARMEMPTY': {
          const [newA] = this.getBlockFromStates(currentState, 'HOLDING', [])
          applyPreconditions('PUTDOWN', [newA!])
        } break
      }

      return {
        op: 'pop',
        object: 'stack',
        element
      }
    }
  }

  solveUntilFinished(options: GSPSolveOptions = {}): void {
    const colorizer = 'color: white; background-color: green; font-size: 1.05rem;'
    let iteration = 0

    this.prepare()

    // buat batas iterasi kalau infinit loopop
    while ((iteration < this.maxIterations) && this._stack.length > 0) {
      if (options.logging) console.log(`%cLANGKAH KE-${iteration}`, colorizer)
      this.solveNextIteration(options)
      if (options.logging) console.log('------------------------------------------------------------')
      iteration++
    }

    if (options.logging) console.log('%cHasil iterasi terakhir:', colorizer)
    if (options.draw) GSP.printStateObject(this.getCurrentStateObject())
    if (options.logging) this.printCurrentIteration()

    if (iteration >= this.maxIterations)
    throw new Error('iterasi lebih dari batas maksimum, memberhentikan')
  }
}

