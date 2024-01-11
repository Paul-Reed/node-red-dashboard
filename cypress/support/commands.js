// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

function loadFlows () {
    cy.intercept('GET', '/flows?_=*').as('getFlows')
    cy.visit('/')
    return cy.wait('@getFlows')
        .then((interception) => {
            return interception.response.body.rev
        })
}

function deployFlow (rev, flows) {
    // Call Node-RED API to load the flow
    return cy.request({
        method: 'POST',
        url: 'http://localhost:1881/flows',
        headers: {
            'Content-type': 'application/json',
            'Node-RED-API-Version': 'v2',
            'Node-RED-Deployment-Type': 'full'
        },
        body: {
            rev,
            flows
        }
    })
}

Cypress.Commands.add('loadFlows', loadFlows)

Cypress.Commands.add('deployFlow', deployFlow)

Cypress.Commands.add('deployFixture', (fixture) => {
    loadFlows().then((rev) => {
        cy.fixture('flows/' + fixture)
            .then((flow) => {
                return deployFlow(rev, flow)
            })
    })
})
