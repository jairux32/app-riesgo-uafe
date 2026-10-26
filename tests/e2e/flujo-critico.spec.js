import { test, expect } from '@playwright/test';

// Flujo crítico contra los emuladores de Firebase: iniciar sesión, completar
// los cuatro pasos del wizard y exportar el dictamen. No prueba la IA (la
// Cloud Function no corre en local) ni la exportación Excel/ROS.

const EMAIL = 'e2e@notaria.test';
const PASSWORD = 'Prueba123!';
const API_KEY = 'demo-api-key';
const CEDULA = '1710034065';

/**
 * Crea la cuenta en el emulador de Auth. Es idempotente: si ya existe, el
 * emulador responde EMAIL_EXISTS y se continúa.
 */
const asegurarUsuario = async (request) => {
  const respuesta = await request.post(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { data: { email: EMAIL, password: PASSWORD, returnSecureToken: true } }
  );

  if (!respuesta.ok()) {
    const cuerpo = await respuesta.text();
    if (!cuerpo.includes('EMAIL_EXISTS')) {
      throw new Error(`No se pudo crear el usuario de prueba: ${cuerpo}`);
    }
  }
};

const iniciarSesion = async (page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Iniciar Sesión' })).toBeVisible();

  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  await expect(page.locator('input[name="notaria"]')).toBeVisible({ timeout: 30_000 });
};

const completarPaso1 = async (page, { acto = 'Poder especial' } = {}) => {
  await page.locator('input[name="notaria"]').fill('Notaría E2E');
  await page.locator('input[name="notario"]').fill('Notario de Prueba');
  await page.locator('input[name="cliente"]').fill('Cliente de Prueba');
  await page.locator('input[name="cedula"]').fill(CEDULA);
  await page.locator('select[name="acto"]').selectOption(acto);
  await page.locator('input[name="valor"]').fill('5000');
  await page.locator('select[name="medioPago"]').selectOption('Transferencia');

  // Sin snapshots de listas el resultado es `no_configurado`; eso habilita la
  // constancia de fuente no disponible para completar la debida diligencia.
  await page.getByRole('button', { name: 'Verificar Ahora' }).click();
  await expect(page.getByText(/Sin fuente configurada para/)).toBeVisible();

  await page.getByLabel('Verifiqué la identidad del cliente con su documento').check();
  await page.getByLabel('Comprendí el propósito y la naturaleza de la operación').check();
  await page.getByLabel('Verifiqué el origen y la licitud de los fondos').check();
  await page.getByLabel('Dejo constancia de que no hay fuente de listas disponible').check();

  await page.getByRole('button', { name: 'Siguiente Paso' }).click();
};

const completarWizard = async (page, opciones = {}) => {
  await completarPaso1(page, opciones);

  // Paso 2: la plantilla completa las 56 señales de una vez.
  await expect(page.getByRole('button', { name: 'Perfil Bajo' })).toBeVisible();
  await page.getByRole('button', { name: 'Perfil Bajo' }).click();
  await page.getByRole('button', { name: 'Siguiente Paso' }).click();

  // Paso 3: se evalúan los 10 controles internos.
  await expect(page.getByRole('heading', { name: /Controles Internos/i })).toBeVisible();
  const controles = page.locator('input[type="checkbox"]');
  for (let i = 0; i < await controles.count(); i += 1) {
    await controles.nth(i).check();
  }
  await page.getByRole('button', { name: 'Finalizar y Analizar' }).click();

  await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeVisible();
};

const guardarCaso = async (page) => {
  await page.getByRole('button', { name: 'Historial' }).click();
  await page.getByRole('button', { name: 'Guardar Caso Actual' }).click();
  await expect(page.getByText(/Caso guardado/i)).toBeVisible({ timeout: 20_000 });

  // El historial queda abierto como modal y bloquea el resto de la interfaz.
  await page.locator('button:has(svg.lucide-x)').first().click();
};

test('flujo crítico: login, wizard completo y exportación en PDF', async ({ page, request }) => {
  await asegurarUsuario(request);
  await iniciarSesion(page);
  await completarWizard(page);

  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar PDF' }).click();
  const archivo = await descarga;

  expect(archivo.suggestedFilename()).toMatch(/^Reporte_Riesgo_.*\.pdf$/);
  expect(await archivo.path()).toBeTruthy();
});

test('guarda el caso y lo recupera desde el dashboard', async ({ page, request }) => {
  await asegurarUsuario(request);
  await iniciarSesion(page);
  await completarWizard(page);
  await guardarCaso(page);

  await page.getByRole('button', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: /Dashboard de Riesgo/i })).toBeVisible();
  // El dashboard no lista clientes: el caso se refleja en el pipeline.
  await expect(page.getByText(/100% del total/)).toBeVisible();
});

test('genera el reporte mensual y oculta el recordatorio', async ({ page, request }) => {
  await asegurarUsuario(request);
  await iniciarSesion(page);
  // Acto distinto para no chocar con el caso guardado por la prueba anterior.
  await completarWizard(page, { acto: 'Compraventa inmueble' });
  await guardarCaso(page);

  await page.getByRole('button', { name: 'Dashboard' }).click();
  await expect(page.getByText('Reporte mensual pendiente')).toBeVisible();

  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Reporte Mensual PDF' }).click();
  const archivo = await descarga;

  expect(archivo.suggestedFilename()).toMatch(/^Reporte_Mensual_\d{4}-\d{2}\.pdf$/);
  expect(await archivo.path()).toBeTruthy();
  await expect(page.getByText('Reporte mensual pendiente')).toBeHidden();
});
