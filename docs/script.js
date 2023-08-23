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
    .generateStateConditions(stateObject).join(' ^ ')

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

const GSPInitialState = {
  arm: null,
  table: [
    ['C', 'B', 'A'],
  ]
}

const GSPGoalState = {
  arm: null,
  table: [
    ['A', 'C'],
    ['B'],
  ]
}

const initialStateElement = createStateElement(GSPInitialState)
const goalStateElement = createStateElement(GSPGoalState)

document.querySelector('#initial-state').replaceChildren(initialStateElement)
document.querySelector('#goal-state').replaceChildren(goalStateElement)

const gsp = new GSP(GSPInitialState, GSPGoalState)
let currentStateString = ''
let step = 0

gsp.prepare()
gsp.solveNextIteration({ draw: true, logging: true })

function resetGSP() {
  step = 0
  gsp._stack.length = 0
  gsp._queue.length = 0
  gsp._state.length = 0
  stateSceneElement.replaceChildren(statePlaceholderElement)
  updateStackQueueState()
  gsp.prepare()
}

function nextIteration() {
  if (!gsp._stack.length) return console.error('step habis')

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
    slotElement.innerText = slot.join(' ^ ')
    stateElement.append(slotElement)
  })
}

document.querySelector('#reset').addEventListener('click', resetGSP)
document.querySelector('#next').addEventListener('click', nextIteration)
document.querySelector('#finish').addEventListener('click', () => {
  if (!gsp._state.length) resetGSP()
  while (gsp._stack.length > 0) nextIteration()
})

