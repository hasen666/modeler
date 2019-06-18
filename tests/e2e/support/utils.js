import { saveDebounce } from '../../../src/components/inspectors/inspectorConstants';
import path from 'path';

const renderTime = 100;

export function getGraphElements() {
  return cy.window()
    .its('store.state.graph')
    .invoke('getCells')
    .then(cells => cells.filter(cell => cell.component));
}

export function getElementAtPosition(position) {
  return cy.window()
    .its('store.state.paper')
    .invoke('findViewsFromPoint', position)
    .then(views => views.filter(view => view.model.component))
    .then(views => views.sort((view1, view2) => {
      /* Sort shape views by z-index descending; the shape "on top" will be first in array. */
      return view2.model.get('z') - view1.model.get('z');
    }))
    .then(views => views[0])
    .then(view => view.$el ? view.$el : null);
}

export function getLinksConnectedToElement($element) {
  return cy.window()
    .its('store.state.graph')
    .invoke('getConnectedLinks', { id: $element.attr('model-id') })
    .then(links => {
      return cy.window().its('store.state.paper').then(paper => {
        return links.map(link => link.findView(paper).$el);
      });
    });
}

export function dragFromSourceToDest(source, position) {
  cy.window().its('store.state.paper').then(paper => {
    const { tx, ty } = paper.translate();

    cy.get('.main-paper').then($paperContainer => {
      const { x, y } = $paperContainer[0].getBoundingClientRect();
      const mouseEvent = { clientX: position.x + x + tx, clientY: position.y + y + ty };

      cy.get(`[data-test=${ source }]`).trigger('mousedown');
      cy.document().trigger('mousemove', mouseEvent);
      cy.document().trigger('mouseup', mouseEvent);
    });
  });

  return waitToRenderAllShapes();
}

export function getCrownButtonForElement($element, crownButton) {
  return cy
    .get(`#${$element.attr('id')} ~ [data-test=${crownButton}]`)
    .then(crownButtons => crownButtons.filter((index, button) => Cypress.$(button).is(':visible')))
    .then(crownButtons => crownButtons[0]);
}

export function typeIntoTextInput(selector, value) {
  cy.get(selector).clear().type(value);
  waitToRenderNodeUpdates();
}

export function waitToRenderAllShapes() {
  cy.wait(renderTime);
}

export function waitToRenderNodeUpdates() {
  cy.wait(saveDebounce);
}

export function connectNodesWithFlow(flowType, startPosition, endPosition) {
  getElementAtPosition(startPosition)
    .click()
    .then($element => {
      return getCrownButtonForElement($element, flowType)
        .click({ force: true });
    })
    .then(() => {
      getElementAtPosition(endPosition)
        .trigger('mousemove', { force: true })
        .wait(renderTime)
        .click({ force: true });
    });
}

export function isElementCovered($element) {
  return cy.window()
    .its('store.state.paper')
    .invoke('findViewsInArea', $element[0].getBBox())
    .then(shapeViews => {
      const zIndexes = shapeViews.filter(shapeView => shapeView.model.component)
        .map(shapeView => shapeView.model.get('z'));

      return cy.window()
        .its('store.state.paper')
        .invoke('getModelById', $element.attr('model-id'))
        .then(shape => {
          const shapeZIndex = shape.get('z');

          return zIndexes.some(zIndex => shapeZIndex < zIndex);
        });
    });
}

export function moveElement(elementPosition, x, y) {
  return cy.window().its('store.state.paper').then(paper => {
    const newPosition = paper.localToPagePoint(x, y);

    return getElementAtPosition(elementPosition)
      .trigger('mousedown', { which: 1, force: true })
      .trigger('mousemove', { clientX: newPosition.x, clientY: newPosition.y, force: true })
      .trigger('mouseup', { force: true });
  });
}

export function removeIndentationAndLinebreaks(string) {
  return string.replace(/(^\s+)|(\n)/gim, '');
}

export const modalAnimationTime = 300;

export function uploadXml(filepath) {
  cy.contains('Upload XML').click();

  /* Wait for modal to open */
  cy.wait(modalAnimationTime);

  cy.fixture(filepath, 'base64').then(bpmnProcess => {
    return cy.get('input[type=file]').then($input => {
      return Cypress.Blob.base64StringToBlob(bpmnProcess, 'text/xml')
        .then((blob) => {
          const file = new File([blob], path.basename(filepath), { type: 'text/xml' });
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          const input = $input[0];
          input.files = dataTransfer.files;
          cy.wrap(input).trigger('change', { force: true });
          return cy.get('#uploadmodal button').contains('Upload').click();
        });
    });
  });

  /* Wait for modal to close */
  cy.wait(modalAnimationTime);
}
