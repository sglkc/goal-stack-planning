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

export default class GSP {
  // Konstanta kondisi pada stack
  static CONDITIONS = ['CLEAR', 'ON', 'ONTABLE', 'HOLDING', 'ARMEMPTY'] as const
  static OPERATORS = ['STACK', 'UNSTACK', 'PICKUP', 'PUTDOWN'] as const
  static PAD: GSPPADType = {
    STACK: {
      P: ['HOLDING(1)', 'CLEAR(2)'],
      A: ['ON(1,2)', 'CLEAR(1)', 'ARMEMPTY'],
      D: ['HOLDING(1)', 'CLEAR(2)']
    },
    UNSTACK: {
      P: ['ON(1,2)', 'CLEAR(1)', 'ARMEMPTY'],
      A: ['HOLDING(1)', 'CLEAR(2)'],
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
  STATE: Array<string[]> = []
  STACK: Array<string> = []
  QUEUE: Array<string> = []

  // Atribut yang bisa diubah user
  maxIterations: number = 10
  initial: GSPStateObject
  goal: GSPStateObject

  // Digunakan untuk menginisialisasi new GSP(initial, goal, 10)
  constructor(initial: GSPStateObject, goal: GSPStateObject, maxIterations = 10) {
    const initialBlocks = GSP.validateStateObject(initial)
    const goalBlocks = GSP.validateStateObject(goal)

    // Cek jika block pada state initial dan goal ada perbedaan
    if (initialBlocks.size !== goalBlocks.size) {
      throw new Error('initial state dan goal state memiliki block yang berbeda')
    }

    initialBlocks.forEach((block) => {
      if (!goalBlocks.has(block)) {
        throw new Error('initial state dan goal state memiliki block yang berbeda')
      }
    })

    this.maxIterations = maxIterations
    this.initial = Object.assign({}, initial)
    this.goal = Object.assign({}, goal)
  }

  // Method static private utk validasi objek state sebelum diproses
  static validateStateObject(state: GSPStateObject): Set<string> {
    const blocks = new Set<string>()

    if (typeof state !== 'object') throw new Error('state harus berupa object')
    if (!Array.isArray(state.table)) throw new Error('state.table harus berupa array')
    if (!(typeof state.arm === 'string' || [null, undefined].includes(state.arm))) {
      throw new Error('state.arm harus berupa string, null, atau undefined')
    }

    state.table.forEach((stack) => {
      stack.forEach((block) => {
        if (blocks.has(block)) throw new Error(`block ${block} ada duplikat`)
        blocks.add(block)
      })
    })

    if (typeof state.arm === 'string') {
      if (blocks.has(state.arm)) throw new Error(`block ${state.arm} ada di table dan arm`)
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

    scene.push('ARM: ' + (state.arm ?? 'KOSONG'))

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
    console.log(scene.join('\n'))
  }

  // Print array ke console
  static prettyPrintArray(...[a, b]: Array<string | string[]>): void {
    const name = (typeof a === 'string' ? a : b as string) ?? ''
    const array = typeof a === 'object' ? a : b as string[]
    const string = array.map((item, i) => `${i + 1}) ${item}`).join('\n').trim()

    console.log(
      `%c${name}`, 'color: white; background-color: royalblue; font-size: 1.15rem',
      '\n' + (array.length ? string : '> ARRAY KOSONG')
    )
  }

  // Generate array kondisi dari objek state
  generateStateConditions(state: GSPStateObject): string[] {
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

  // Print STATE, STACK, dan QUEUE saat ini
  printCurrentIteration(prettify = true): void {
    if (prettify) {
      GSP.prettyPrintArray('STACK', [...this.STACK])
      GSP.prettyPrintArray('STATE', this.STATE.map(i => i.join(' ^ ')))
      GSP.prettyPrintArray('QUEUE', this.QUEUE)
    } else {
      console.log('STACK', JSON.stringify([...this.STACK].reverse(), null, 1))
      console.log('STATE', JSON.stringify([...this.STATE].reverse(), null, 1))
    }
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

    const [, a, b] = stateMatch.match(/\w+/ig)

    return [a, b]
  }

  applyPAD(
    pad: 'P' | 'A' | 'D' | 'AD',
    states: typeof this.STATE[number],
    operator: GSPOperator,
    [A, B]: string[],
  ): string[] {

    const newState = Array.from(states)

    if (pad === 'AD') {
      const addedStates = this.applyPAD('A', states, operator, [A, B])
      const finalStates = this.applyPAD('D', addedStates, operator, [A, B])

      this.STATE.push(finalStates)
      return
    }

    const conditions = GSP.PAD[operator][pad].map((condition) => {
      return condition.replace('1', A).replace('2', B)
    })

    switch (pad) {
      case 'P':
        const nextOperand = B ? `,${B}` : ''

        this.STACK.push(`${operator}(${A}${nextOperand})`)
        this.STACK.push(conditions.join(' ^ '))
        conditions.forEach((condition) => this.STACK.push(condition))

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

  //
  solveNextIteration(): void {
    const currentSlot = this.STACK.at(-1)
    const nextSlot = this.STACK.at(-2) ?? ''
    const currentState = this.STATE.at(-1)

    if (!currentSlot) throw new Error('stack kosong, tidak dapat melanjutkan')

    const [slotName, A, B] = currentSlot.match(/\w+/ig)
    const nextSlotMatches = nextSlot.match(/\w+/ig)

    this.printCurrentIteration()
    console.log('CURRENT STATE:', currentState)
    console.log('CURRENT STACK:', currentSlot)

    // Jika slot saat ini terpenuhi oleh state saat ini dan slot dibawahnya
    // bukan operator, maka pop dari stack
    // Referensi PDF Planning GSP CP: Langkah 3 Kondisi 1
    if (currentState.includes(currentSlot) && nextSlotMatches) {
      console.log('kondisi 1')
      const nextSlotName = nextSlotMatches[0] as GSPOperator

      if (!GSP.OPERATORS.includes(nextSlotName)) {
        console.log('kondisi 1, memenuhi, pop')
        return void this.STACK.pop()
      }
    }

    // Jika state saat ini terdapat slot saat ini, maka pop dari stack
    // Jika queue teratas tidak terdapat slot saat ini, maka masukkan
    // Referensi PDF Planning GSP CP: Langkah 3 Kondisi 4
    if (GSP.OPERATORS.includes(slotName as GSPOperator)) {
      console.log('kondisi 4, memenuhi, pop')
      const operation = this.STACK.pop()
      const [operator] = operation.match(/\w+/ig)

      if (this.QUEUE.at(-1) !== operation) {
        console.log('kondisi 4, queue tidak sama dengan operasi saat ini, push', operation)
        this.QUEUE.push(operation)
        this.applyPAD('AD', currentState, operator as GSPOperator, [A, B])
      }

      return
    }

    // Jika slot berisi kondisi atau rangkaian kondisi dan berada di atas slot
    // yang berisi operator, maka pop slot teratas dari stack dan pop slot
    // selanjutnya dan masukkan ke queue, dan update current-state
    // Referensi PDF Planning GSP CP: Langkah 3 Kondisi 3
    const nextSlotName = nextSlotMatches?.[0] as GSPOperator
    if (currentSlot.includes('^') || (slotName === 'HOLDING' && GSP.OPERATORS.includes(nextSlotName))) {
      console.log('kondisi 3, rangkaian kondisi atau holding')

      this.STACK.pop()

      const slotConditions = currentSlot.split(' ^ ')
      const conflict = slotConditions.find((op) => !currentState.includes(op))

      if (conflict) {
        console.log('kondisi 3, konflik diteumakan', conflict)
        return void this.STACK.push(conflict)
      }

      if (!this.STACK.length) return
      if (GSP.OPERATORS.includes(nextSlotName)) {
        console.log('kondisi 3, slot selanjutnya adalah operator')

        const operation = this.STACK.pop()
        const [operator, A, B] = operation.match(/\w+/ig)

        console.log('kondisi 3, pop slot masukan operation ke queue', operation)
        this.QUEUE.push(operation)
        this.applyPAD('AD', currentState, operator as GSPOperator, [A, B])

        return
      }

      console.log('kondisi 3, nevermind')
    }

    // Jika nama slot adalah suatu kondisi (ON, ONTABLE, ...) maka tambah
    // operator (STACK, PICKUP, ...) dan PRECONDITION untuk operator tersebut
    // Referensi PDF Planning GSP CP: Langkah 3 Kondisi 2
    if (GSP.CONDITIONS.includes(slotName as GSPCondition)) {
      console.log('kondisi 2, tambah precondition dari', slotName)
      this.STACK.pop()

      switch (slotName) {
        case 'CLEAR': {
          const [newA] = this.getBlockFromStates(currentState, 'ON', [, A])
          if (newA) {
            this.applyPAD('P', currentState, 'UNSTACK', [newA, A])
          } else {
            this.applyPAD('P', currentState, 'PICKUP', [A])
          }
        } break
        case 'ON': {
          if (currentState.includes(`HOLDING`)) {
            this.applyPAD('P', currentState, 'PUTDOWN', [A])
          } else {
            this.applyPAD('P', currentState, 'STACK', [A, B])
          }
        } break
        case 'ONTABLE': {
          this.applyPAD('P', currentState, 'PUTDOWN', [A])
        } break
        case 'HOLDING': {
          const [, newB] = this.getBlockFromStates(currentState, 'ON', [A])

          if (currentState.includes(`ONTABLE(${A})`)) {
            this.applyPAD('P', currentState, 'PICKUP', [A])
          } else if (newB) {
            this.applyPAD('P', currentState, 'UNSTACK', [A, newB])
          } else {
            this.applyPAD('P', currentState, 'PUTDOWN', [A])
          }
        } break
        case 'ARMEMPTY': {
          const [newA] = this.getBlockFromStates(currentState, 'HOLDING', [])
          this.applyPAD('P', currentState, 'PUTDOWN', [newA])
        } break;
      }

      return
    }
  }

  solveUntilFinished(): void {
    const initialConditions = this.generateStateConditions(this.initial)
    const goalConditions = this.generateStateConditions(this.goal)
    let iteration = 0

    // masukkan state dan stack 0
    this.STATE.push(initialConditions)
    this.STACK.push(goalConditions.join(' ^ '))
    this.STACK.push(...goalConditions)

    // buat batas iterasi kalau infinit loopop
    while ((iteration < this.maxIterations) && this.STACK.length > 0) {
      console.log(
        `%cLANGKAH KE-${iteration}`,
        'color: white; background-color: green; font-size: 1.25rem;'
      )
      this.solveNextIteration()
      console.log('------------------------------------------------------------')
      iteration++
    }

    this.printCurrentIteration()

    if (iteration >= this.maxIterations)
    console.log('iterasi lebih dari batas maksimum, memberhentikan')
  }
}

