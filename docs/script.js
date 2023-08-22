const mainElement = document.getElementById('main')
const originalStepPlaceholderElement = document.getElementById('step-placeholder')
const stepPlaceholderElement = originalStepPlaceholderElement.cloneNode(true)

stepPlaceholderElement.removeAttribute('id')
stepPlaceholderElement.classList.remove('hidden')
originalStepPlaceholderElement.remove()

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

const gsp = new GSP(GSPInitialState, GSPGoalState)

let step = 0
let currentStateString = ''

function resetGSP() {
  step = 0
  gsp.prepare()
  mainElement.innerHTML = ''
}

function nextIteration() {
  if (!gsp._state.length) {
    resetGSP()
    nextIteration()
    return
  }

  if (!gsp._stack.length) return console.error('step habis')

  const stateObject = gsp.getCurrentStateObject()
  const stateString = gsp._state.at(-1).join(' ^ ')

  if (stateString === currentStateString) {
    gsp.solveNextIteration()
    nextIteration()
    return
  }

  currentStateString = stateString

  const stepElement = stepPlaceholderElement.cloneNode(true)
  const armElement = stepElement.querySelector('.arm')
  const tableElement = stepElement.querySelector('.table')

  stepElement.querySelector('.step-number').innerText = step

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

  armElement.innerText = stateObject.arm
  mainElement.append(stepElement)
  stepElement.scrollIntoView({ behavior: 'smooth' })
  gsp.solveNextIteration()
  step++
}

document.querySelector('#reset').addEventListener('click', resetGSP)
document.querySelector('#next').addEventListener('click', nextIteration)
document.querySelector('#finish').addEventListener('click', () => {
  if (!gsp._state.length) resetGSP()
  while (gsp._stack.length > 0) nextIteration()
})
