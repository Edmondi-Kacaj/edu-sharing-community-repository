/**
 * Replaces the given element with a div within the DOM.
 * 
 * The purpose is to comply with W3C specifications for element and attribute names.
 * 
 * Sets the attribute "data-element" to the old element tag name.
 */
export function replaceElementWithDiv(element: Element): HTMLDivElement {
    const div = document.createElement('div');
    div.setAttribute('data-element', element.localName);
    for (const attribute of element.attributes) {
        const targetAttributeName = getTargetAttributeName(attribute);
        div.setAttribute(targetAttributeName, attribute.nodeValue);
    }
    element.parentNode.replaceChild(div, element);
    return div;
}

/**
 * Returns the name with which to copy attributes to the new element.
 *
 * Keeps "style", "class", and "data-" attributes and prefixes everything else with
 * "data-attribute-".
 */
function getTargetAttributeName(attr: Attr): string {
    if (['style', 'class'].includes(attr.nodeName)) {
        return attr.nodeName;
    } else if (attr.nodeName.startsWith('data-')) {
        return attr.nodeName;
    } else {
        return 'data-attribute-' + attr.nodeName;
    }
}
