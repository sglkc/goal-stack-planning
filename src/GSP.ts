export type StateObject = {
  table: string[][],
  arm: string | null | undefined
}

export default class GSP {
  // Konstanta kondisi pada stack
  static CONDITIONS = ['CLEAR', 'ON', 'ONTABLE', 'HOLDING', 'ARMEMPTY']
  static OPERATIONS = ['STACK', 'UNSTACK', 'PICKUP', 'PUTDOWN']

  // Progress menyelesaian
  STATE: Array<string[]> = []
  STACK: Array<string> = []
  QUEUE: Array<string> = []

  // Atribut yang bisa diubah user
  maxIterations: number = 10
  initial: StateObject
  goal: StateObject

  // Digunakan untuk menginisialisasi new GSP(initial, goal, 10)
  constructor(initial: StateObject, goal: StateObject, maxIterations = 10) {
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
  static validateStateObject(state: StateObject): Set<string> {
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
  static printStateObject(state: StateObject, name?: string): void {
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
  generateStateConditions(state: StateObject): string[] {
    const conditions: string[] = []

    state.table.forEach((stack) => {

      // Reverse array karena data struktur stack dimulai dari akhir
      const reversedStack = Array.from(stack).reverse()

      reversedStack.forEach((block, blockIndex) => {
        if (blockIndex === reversedStack.length - 1) {
          conditions.push(`ONTABLE(${block})`)
        } else {
          const nextBlock = reversedStack.at(blockIndex + 1)
          conditions.push(`ON(${block},${nextBlock})`)
        }
      })
      })

    if (state.arm) conditions.push(`HOLDING(${state.arm})`)
    else conditions.push(`ARMEMPTY`)

    return conditions
  }

  // Print STATE, STACK, dan QUEUE saat ini
  printCurrentIteration(prettify = true): void {
    if (prettify) {
      GSP.prettyPrintArray('STATE', this.STATE.map(i => i.join(' ^ ')))
      GSP.prettyPrintArray('STACK', [...this.STACK].reverse())
      GSP.prettyPrintArray('QUEUE', this.QUEUE)
    } else {
      console.log('STATE', JSON.stringify([...this.STATE].reverse(), null, 1))
      console.log('STACK', JSON.stringify([...this.STACK].reverse(), null, 1))
    }
  }

  findBFromStates(states: string[], name: string, a: string): string | false {
    const regexp = new RegExp(`${name}\\(${a}`, 'i')
    const stateMatch = states.find((state) => state.match(regexp))

    if (!stateMatch) return false

    const [, b] = stateMatch.match(/,(\w+)\)/i) ?? []

    return b ?? false
  }

  //
  solveNextIteration(): void {
    const currentElement = this.STACK.at(-1)
    const currentState = this.STATE.at(-1)!

    if (!currentElement) throw new Error('stack kosong, tidak dapat melanjutkan')

    const [elementName, A, B] = currentElement.match(/\w+/ig)!

    this.printCurrentIteration()
    console.log('CURRENT STATE:', currentState)
    console.log('CURRENT STACK:', currentElement)

    // Jika state saat ini terdapat element saat ini, maka pop dari stack dan
    // selesaikan iterasi saat ini
    if (currentState.includes(currentElement)) return void this.STACK.pop()

    // Jika nama element adalah suatu kondisi (ON, ONTABLE, ...) maka tambah
    // operator (STACK, PICKUP, ...) dan PRECONDITION untuk operator tersebut
    if (GSP.CONDITIONS.includes(elementName)) {
      switch (elementName) {
        case 'CLEAR': {
          this.STACK.pop()
        } break;
        case 'ON': {
          this.STACK.push(`STACK(${A},${B})`)
          this.STACK.push(`HOLDING(${A})`, `CLEAR(${B})`)
        } break;
        case 'ONTABLE': {
          this.STACK.push(`PUTDOWN(${A})`)
          this.STACK.push(`HOLDING(${A})`)
        } break;
        case 'HOLDING': {
          if (currentState.includes(`ONTABLE(${A})`)) {
            this.STACK.push(`PICKUP(${A})`)
            this.STACK.push(`ONTABLE(${A})`, `CLEAR(${A})`, `ARMEMPTY`)
          } else {
            const b = this.findBFromStates(currentState, 'ON', A)
            this.STACK.push(`UNSTACK(${A},${b})`)
            this.STACK.push(`ON(${A},${b})`, `CLEAR(${A})`, `ARMEMPTY`)
          }
        } break;
        case 'ARMEMPTY': {
          this.STACK.pop()
        } break;
      }
    }

    // Jika nama element adalah suatu operator (STACK, PICKUP, ...) maka pop
    // dari stack dan tambah ADD dan hapus DELETE sesuai PAD
    if (GSP.OPERATIONS.includes(elementName)) {
      const newState = Array.from(currentState)

      this.STACK.pop()
      this.QUEUE.push(currentElement)

      switch (elementName) {
        case 'STACK':
          newState.push(`ON(${A},${B})`, `ARMEMPTY`);
          [`HOLDING(${A})`, `CLEAR(${B})`].forEach((d) => newState.splice(newState.indexOf(d), 1))
          break;
        case 'UNSTACK':
          newState.push(`HOLDING(${A})`, `CLEAR(${B})`);
          [`ON(${A},${B})`, `ARMEMPTY`].forEach((d) => newState.splice(newState.indexOf(d), 1))
          break;
        case 'PICKUP':
          newState.push(`HOLDING(${A})`);
          [`ONTABLE(${A})`, `ARMEMPTY`].forEach((d) => newState.splice(newState.indexOf(d), 1))
          break;
        case 'PUTDOWN':
          newState.push(`ONTABLE(${A})`, `ARMEMPTY`);
          [`HOLDING(${A})`].forEach((d) => newState.splice(newState.indexOf(d), 1))
          break;
      }

      this.STATE.push(newState)
    }
  }

  solveUntilFinished(): void {
    const initialConditions = this.generateStateConditions(this.initial)
    const goalConditions = this.generateStateConditions(this.goal)
    let iteration = 0

    // masukkan state dan stack 0
    this.STATE.push(initialConditions)
    //this.STACK.push(goalConditions.join(' ^ '))
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

export {}
