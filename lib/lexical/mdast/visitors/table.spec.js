/* global describe, expect, test */

import { createHeadlessEditor } from '@lexical/headless'
import { $createParagraphNode, $createTextNode } from 'lexical'
import { $createTableCellNode, TableCellNode } from '@lexical/table'
import { LexicalTableCellVisitor } from './table'

describe('table markdown round trip', () => {
  test('exports paragraph text directly inside table cells', () => {
    const editor = createHeadlessEditor({
      namespace: 'table-mdast-test',
      nodes: [TableCellNode],
      onError: error => { throw error }
    })

    let tableRow

    editor.update(() => {
      const textNode = $createTextNode('value')
      const paragraphNode = $createParagraphNode().append(textNode)
      const cellNode = $createTableCellNode().append(paragraphNode)
      tableRow = { type: 'tableRow', children: [] }

      const actions = {
        appendToParent (parentNode, node) {
          parentNode.children.push(node)
          return node
        },
        addAndStepInto (type) {
          const node = actions.appendToParent(tableRow, { type, children: [] })
          actions.visitChildren(cellNode, node)
        },
        visitChildren (lexicalNode, parentNode) {
          lexicalNode.getChildren().forEach(child => actions.visit(child, parentNode))
        },
        visit (lexicalNode, parentNode) {
          if (lexicalNode.getType() === 'paragraph') {
            const node = actions.appendToParent(parentNode, { type: 'paragraph', children: [] })
            actions.visitChildren(lexicalNode, node)
            return
          }

          if (lexicalNode.getType() === 'text') {
            actions.appendToParent(parentNode, { type: 'text', value: lexicalNode.getTextContent() })
          }
        }
      }

      LexicalTableCellVisitor.visitLexicalNode({
        lexicalNode: cellNode,
        mdastParent: tableRow,
        actions
      })
    }, { discrete: true })

    expect(tableRow).toEqual({
      type: 'tableRow',
      children: [
        {
          type: 'tableCell',
          children: [{ type: 'text', value: 'value' }]
        }
      ]
    })
  })
})
