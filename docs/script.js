const stateSceneElement = document.querySelector('#state-scene')
const originalStatePlaceholderElement = document.querySelector('#state-placeholder')
const statePlaceholderElement = originalStatePlaceholderElement.cloneNode(true)

statePlaceholderElement.removeAttribute('id')
statePlaceholderElement.classList.remove('hidden')
originalStatePlaceholderElement.remove()

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
    ['A', 'B', 'C'],
  ]
}

const GSPGoalState = {
  arm: null,
  table: [
    ['B'],
    ['A'],
    ['C'],
  ]
}

const initialStateElement = createStateElement(GSPInitialState)
const goalStateElement = createStateElement(GSPGoalState)

document.querySelector('#initial-state').replaceChildren(initialStateElement.cloneNode(true))
document.querySelector('#goal-state').replaceChildren(goalStateElement)
stateSceneElement.replaceChildren(initialStateElement)

const gsp = new GSP(GSPInitialState, GSPGoalState)
let currentStateString = ''
let step = 0

gsp.prepare()
gsp.solveNextIteration({ draw: true, logging: true })

function resetGSP() {
  step = 0
  gsp.prepare()
  stateSceneElement.innerHTML = ''
  nextIteration()
}

function nextIteration() {
  if (!gsp._state.length) {
    resetGSP()
    nextIteration()
    return
  }

  if (!gsp._stack.length) return console.error('step habis')

  const stateObject = gsp.getCurrentStateObject()
  //const stateString = gsp._state.at(-1).join(' ^ ')

  //if (stateString === currentStateString) {
  //  gsp.solveNextIteration()
  //  nextIteration()
  //  return
  //}

  //currentStateString = stateString
  const stateElement = createStateElement(stateObject)

  stateSceneElement.replaceChildren(stateElement)
  stateElement.scrollIntoView({ behavior: 'smooth' })
  gsp.solveNextIteration()
  step++
}

document.querySelector('#reset').addEventListener('click', resetGSP)
document.querySelector('#next').addEventListener('click', nextIteration)
document.querySelector('#finish').addEventListener('click', () => {
  if (!gsp._state.length) resetGSP()
  while (gsp._stack.length > 0) nextIteration()
})

