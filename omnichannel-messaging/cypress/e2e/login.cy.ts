describe("Login Page", () => {
  beforeEach(() => {
    cy.visit("/login")
  })

  it("should display the login form", () => {
    cy.get("h2").should("contain", "Sistema de Gestión de Mensajes")
    cy.get('input[name="email"]').should("exist")
    cy.get('input[name="password"]').should("exist")
    cy.get('button[type="submit"]').should("exist")
  })

  it("should show error message with invalid credentials", () => {
    cy.get('input[name="email"]').type("test@example.com")
    cy.get('input[name="password"]').type("wrongpassword")
    cy.get('button[type="submit"]').click()

    // Esperar a que aparezca el mensaje de error
    cy.get(".text-red-700").should("be.visible")
  })

  it("should redirect to dashboard with valid credentials", () => {
    // Interceptar la llamada a la API de autenticación
    cy.intercept("POST", "**/auth/v1/token*", {
      statusCode: 200,
      body: {
        access_token: "fake-token",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "fake-refresh-token",
        user: {
          id: "123",
          email: "test@example.com",
        },
      },
    }).as("loginRequest")

    cy.get('input[name="email"]').type("test@example.com")
    cy.get('input[name="password"]').type("password123")
    cy.get('button[type="submit"]').click()

    cy.wait("@loginRequest")

    // Verificar redirección al dashboard
    cy.url().should("include", "/dashboard/conversations")
  })
})

