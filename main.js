const types = {
  REPLACE: 'REPLACE',
  PROPS: "PROPS",
  REMOVE: 'REMOVE',
  INSERT: 'INSERT',
  TEXT: 'TEXT'
}

// 转为vritual DOM
class vritualDom {
  constructor(node) {
    this.tagName = node.tagName.toLowerCase()
    this.props = getProps(node) || {}
    this.key = this.props ? this.props.key : void 0
    this.children = getChildren(node)

    let count = 0

    each(this.children, (child, i) => {  
      if (child instanceof vritualDom) {
        count += child.count
      } else {
        this.children[i] = '' + child
      }
      count ++
    })

    this.count = count
  }
  // 渲染
  render() {
    const el = document.createElement(this.tagName)
    let props = this.props
    let children = this.children || []

    for (let attr in props) {
      setAttr(el, attr, props[attr])
    }

    children.forEach(child => {
      let childEl = (child instanceof vritualDom) ? child.render() : document.createTextNode(child)
      el.appendChild(childEl)
    })

    return el
  }
}

function toVritualDom(node) {  
  return new vritualDom(node)
}

// 虚拟dom的比较
function diff(oldNode, newNode) {  
  let patches = {}
  let index = 0
  dasWalk(oldNode, newNode, index, patches)
  return patches
}

function dasWalk(oldNode, newNode, index, patches) {
  let currentPatches = []
  if (isUndef(newNode)) {}
  else if (isString(oldNode) && isString(newNode)) {
    if (newNode !== oldNode) {
      currentPatches.push({
        type: types.TEXT,
        text: newNode
      })
    }
  }
  else if (oldNode.tagName === newNode.tagName) {
    let propsPatches = diffProps(oldNode, newNode)
    if (propsPatches) {
      currentPatches.push({
        type: types.PROPS,
        props: propsPatches
      })
    }

    diffChildren(
      oldNode.children,
      newNode.children,
      index,
      currentPatches,
      patches
    )
  } else {
    currentPatches.push({
      type: types.REPLACE,
      node: newNode
    })
  }

  if (currentPatches.length) {
    patches[index] = currentPatches
  }
}

function diffChildren(oldChildren, newChildren, index, currentPatches, patches) {  
  let node = null
  let currentIndex = index
  each(oldChildren, function (child, i) {
    let newChild = newChildren[i]
    if (newChild) {
      currentIndex = (node && node.count) ? currentIndex + node.count + 1 : currentIndex + 1
      dasWalk(child, newChild, currentIndex, patches)
      node = child
    } else {
      currentPatches.push({
        type: types.REMOVE,
        index: i
      })
    }
  })
  if (oldChildren.length < newChildren.length) {
    let i = oldChildren.length
    while(i < newChildren.length) {
      let newChild = newChildren[i]
      currentPatches.push({
        type: types.INSERT,
        node: newChild
      })
      i++
    }
  }
}

function diffProps(oldNode, newNode) {  
  let oldProps = oldNode.props
  let newProps = newNode.props
  
  let hasDiff = false
  let key, value
  let currentProps = {}

  for (key in oldProps) {
    value = oldProps[key]
    if (newProps[key] !== value) {
      hasDiff = true
      currentProps[key] = newProps[key]
    }
  }

  for (key in newProps) {
    if (!oldNode.hasOwnProperty(key)) {
      hasDiff = true
      currentProps[key] = newProps[key]
    }
  }

  if (hasDiff) {
    return currentProps
  }

  return null
}

// 将对比结果展示到view
function patch(rootNode, patches) {
  let walker = {
    index: 0
  }
  patchDom(rootNode, walker, patches)
}

function patchDom(node, walker, patches) {  
  let currentPatches = patches[walker.index]

  var len = node.childNodes ? node.childNodes.length : 0
  for (var i = 0; i < len; i++) {
    let child = node.childNodes[i]
    walker.index++
    patchDom(child, walker, patches)
  }
  
  if (currentPatches) {
    applyPatches(node, currentPatches)
  }
}

function applyPatches(node, currentPatches) {
  let removeCount = 0
  each(currentPatches, function (patch) {  
    switch (patch.type) {
      case types.TEXT:
        if (node.textContent) {
          node.textContent = patch.text
        } else {
          node.nodeValue = patch.text
        }
        break
      case types.REPLACE:
        let newNode = (typeof patch.node === 'string') ? document.createTextNode(patch.node) : patch.node.render()
        node.parentNode.replaceChild(newNode, node)
        break
      case types.INSERT:
        let insertChild = (typeof patch.node === 'string') ? document.createTextNode(patch.node) : patch.node.render()
        node.appendChild(insertChild)
        break
      case types.PROPS:
        setProps(node, patch.props)
        break
      case types.REMOVE:
        let removeIndex = patch.index - removeCount
        node.removeChild(node.childNodes[removeIndex])
        removeCount++
        break
      default:
        break
    }
  })
}

function setProps(node, props) {  
  for (var key in props) {
    if (isUndefined(props[key])) {
      node.removeAttribute(key)
    } else {
      setAttr(node, key, props[key])
    }
  }
}

function each(list, fn) {  
  if (isArray(list)) {
    list.forEach(fn)
  } else if (typeof list === 'object') {
    for (let key in list) {
      fn(list[key], key)
    }
  }
}

function isUndefined(val) {  
  return typeof val === 'undefined'
}

function isString(val) {
  return typeof val === 'string'
}

function isUndef(val) {  
  return typeof val === 'undefined' || val === null
}

function isArray(arr) {  
  return Array.isArray(arr)
}

function setAttr(node, key, value) {
  switch (key) {
    case 'style':
      let styleValue = ''
      if (isString(value)) {
          styleValue = value
      } else {
          each(value, function(val, prop) {
              styleValue += hump2lineae(prop) + ':' + String(val) + ''
          })
      }
      node.style = styleValue
      break
    case 'value':
      var tagName = node.tagName || ''
      tagName = tagName.toLowerCase()
      if (
          tagName === 'input' || tagName === 'textarea'
      ) {
          node.value = value
      } else {
          // if it is not a input or textarea, use `setAttribute` to set
          node.setAttribute(key, value)
      }
      break
    default:
      node.setAttribute(key, value)
  }
}

function getChildren(node) {
  let children = node.childNodes || []
  let newChild = []
  children.forEach(element => {
    if (element.innerHTML) {
      let newEl = toVritualDom(element)
      if (element.childElementCount || element.children.length) {
        let newChildren = getChildren(element)
        newEl['children'] = newChildren
      } else {
        newEl['children'] = [element.innerHTML]
      }
      newChild.push(newEl)
    } else if (element.textContent.trim()) {
      let type = element.nodeType
      if (type === 3) {
        newChild.push(element.textContent.trim())
      }
    } else if(element.tagName) {
      let newEl = toVritualDom(element)
      newChild.push(newEl)
    }
  })
  return newChild
}

function getProps(node) {
  let props = {}
  let attributes = node.attributes
  for (let attr in attributes) {
    if (isNumber(attr)) {
      let obj = attributes[attr]
      let key = obj['name']
      let val = obj['value']
      props[key] = val
    }
  }
  return props
}

function isNumber(val) {  
  return !isNaN(Number(val))
}

function isComment(node) {
  return node.nodeType === 8
}
