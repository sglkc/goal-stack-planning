const stateSceneElement = document.querySelector('#state-scene')
const stackElement = document.querySelector('#stack')
const queueElement = document.querySelector('#queue')
const stateElement = document.querySelector('#state')

const originalStatePlaceholderElement = document.querySelector('#state-placeholder')
const statePlaceholderElement = originalStatePlaceholderElement.cloneNode(true)

statePlaceholderElement.removeAttribute('id')
statePlaceholderElement.classList.remove('hidden')
originalStatePlaceholderElement.remove()

const originalSlotElement = document.querySelector('#slot-placeholder')
const slotPlaceholderElement = originalSlotElement.cloneNode(true)

statePlaceholderElement.removeAttribute('id')
statePlaceholderElement.classList.remove('hidden')
originalSlotElement.remove()

function createStateElement(stateObject) {
  const stateElement = statePlaceholderElement.cloneNode(true)
  const armElement = stateElement.querySelector('.arm')
  const tableElement = stateElement.querySelector('.table')

  if (stateObject.arm) {
    armElement.innerText = stateObject.arm
  } else {
    armElement.remove()
  }

  stateElement.querySelector('p').innerText = GSP
    .generateStateConditions(stateObject)
    .sort((a, b) => b.localeCompare(a))
    .join(' ^ ')

  stateObject.table.forEach((blocks) => {
    const blocksElement = document.createElement('div')

    blocksElement.classList.add('blocks')
    tableElement.insertAdjacentElement('beforeend', blocksElement)

    blocks.forEach((block) => {
      const blockElement = document.createElement('div')

      blockElement.innerText = block
      blockElement.classList.add('block')
      blocksElement.insertAdjacentElement('afterbegin', blockElement)
    })
  })

  return stateElement
}

const defaultInitial = {
  arm: null,
  table: [
    ['C', 'B', 'A'],
  ]
}

const defaultGoal = {
  arm: null,
  table: [
    ['A', 'C'],
    ['B'],
  ]
}

const gsp = new GSP(defaultInitial, defaultGoal)
let currentStateString = ''
let step = 0

function resetGSP() {
  step = 0
  gsp._stack.length = 0
  gsp._queue.length = 0
  gsp._state.length = 0
  stateSceneElement.replaceChildren(statePlaceholderElement)
  updateStackQueueState()
  gsp.prepare()
}

function setInitialGoal(initial, goal) {
  initial ||= defaultInitial
  goal ||= defaultGoal

  const initialStateElement = createStateElement(initial)
  const goalStateElement = createStateElement(goal)

  gsp.initial = initial
  gsp.goal = goal

  document.querySelector('#initial-state').replaceChildren(initialStateElement)
  document.querySelector('#goal-state').replaceChildren(goalStateElement)
  resetGSP()
}

function nextIteration() {
  if (!gsp._stack.length) {
    updateStackQueueState()
    setTimeout(() => alert(
      'Problem has been solved, set another problem or reset current problem'
      + ' using the buttons below'
    ), 100)
    return
  }

  const stateObject = gsp.getCurrentStateObject()
  const stateElement = createStateElement(stateObject)

  stateSceneElement.replaceChildren(stateElement)
  gsp.solveNextIteration()
  updateStackQueueState()
  step++
}

function updateStackQueueState() {
  stackElement.replaceChildren()
  gsp._stack.forEach((slot) => {
    const slotElement = slotPlaceholderElement.cloneNode(true)
    slotElement.innerText = slot
    stackElement.append(slotElement)
  })

  queueElement.replaceChildren()
  gsp._queue.forEach((slot) => {
    const slotElement = slotPlaceholderElement.cloneNode(true)
    slotElement.innerText = slot
    queueElement.append(slotElement)
  })

  stateElement.replaceChildren()
  gsp._state.forEach((slot) => {
    const slotElement = slotPlaceholderElement.cloneNode(true)
    slotElement.innerText = slot.sort((a, b) => b.localeCompare(a)).join(' ^ ')
    stateElement.append(slotElement)
  })

  setTimeout(() => stateElement.lastChild?.scrollIntoView({ behavior: 'smooth' }), 200)
}

function setStateInput(name) {
  const armInput = prompt(`${name} | Arm state (type holding block or leave blank)`)
  let tableInput = ''

  while (tableInput.length < 1) {
    tableInput = prompt(
      `${name} | Table state (Use comma [,] to separate between block stacks)\n`
      + 'eg. AB, D -> ONTABLE(A) ^ ON(B,A) ^ CLEAR(B) ^ ONTABLE(D)'
    )
    if (tableInput.length < 1) alert(`${name} | Table state cannot be empty`)
  }

  const object = {
    arm: armInput || null,
    table: []
  }

  tableInput.trim().split(',').forEach((table, i) => {
    object.table.push([])
    table.trim().split('').forEach((block) => object.table[i].push(block))
  })

  try {
    GSP.validateStateObject(object)
  } catch (error) {
    alert(`Error setting state for ${name} ` + error)
  }

  return object
}

document.addEventListener('DOMContentLoaded', () => {
  resetGSP()
  setInitialGoal()
})

document.querySelector('#set-states').addEventListener('click', () => {
  if (
    !confirm(
      'To properly set the states, you have to follow the rules provided,'
      + ' there will be validation so don\'t worry if you make a mistake'
    )
  ) return

  let isError = false

  do {
    isError = false

    try {
      const initial = setStateInput('INITIAL')
      const goal = setStateInput('GOAL')

      setInitialGoal(initial, goal)
    } catch (error) {
      isError = true
      if (!confirm(`Error setting initial and goal state: ${error}\nRetry?`)) return
    }
  } while (isError)
})

document.querySelector('#reset').addEventListener('click', resetGSP)
document.querySelector('#next').addEventListener('click', nextIteration)
document.querySelector('#finish').addEventListener('click', () => {
  if (!gsp._state.length) resetGSP()
  while (gsp._stack.length > 0) nextIteration()
  nextIteration()
})
