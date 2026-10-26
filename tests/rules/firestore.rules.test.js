// Tests de las reglas de Firestore contra el emulador.
//
// Se ejecutan con `npm run test:rules`, que levanta el emulador con
// `firebase emulators:exec` (requiere Java). No forman parte de `npm test`
// para no exigir el emulador en cada corrida de unidad.

import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

const PROYECTO = 'demo-riesgo-uafe';
const REGLAS = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const ALICE = 'alice';
const BOB = 'bob';

let entorno;

const dbDe = (uid) => entorno.authenticatedContext(uid).firestore();
const dbAnonima = () => entorno.unauthenticatedContext().firestore();

const sembrar = async (ruta, datos) => {
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await setDoc(doc(contexto.firestore(), ruta), datos);
  });
};

beforeAll(async () => {
  entorno = await initializeTestEnvironment({
    projectId: PROYECTO,
    firestore: { rules: REGLAS }
  });
});

afterEach(async () => {
  await entorno.clearFirestore();
});

afterAll(async () => {
  await entorno.cleanup();
});

describe('cases', () => {
  it('permite crear un caso propio', async () => {
    await assertSucceeds(
      setDoc(doc(dbDe(ALICE), 'cases/c1'), { userId: ALICE, datos: { cliente: 'Ana' } })
    );
  });

  it('rechaza crear un caso a nombre de otro usuario', async () => {
    await assertFails(
      setDoc(doc(dbDe(ALICE), 'cases/c1'), { userId: BOB, datos: {} })
    );
  });

  it('rechaza crear un caso sin autenticación', async () => {
    await assertFails(
      setDoc(doc(dbAnonima(), 'cases/c1'), { userId: ALICE, datos: {} })
    );
  });

  it('permite leer el caso propio y rechaza el ajeno', async () => {
    await sembrar('cases/de-alice', { userId: ALICE });
    await sembrar('cases/de-bob', { userId: BOB });

    await assertSucceeds(getDoc(doc(dbDe(ALICE), 'cases/de-alice')));
    await assertFails(getDoc(doc(dbDe(ALICE), 'cases/de-bob')));
    await assertFails(getDoc(doc(dbAnonima(), 'cases/de-alice')));
  });

  it('solo lista los casos propios y exige el filtro userId', async () => {
    await sembrar('cases/de-alice', { userId: ALICE });
    await sembrar('cases/de-bob', { userId: BOB });

    const propios = query(collection(dbDe(ALICE), 'cases'), where('userId', '==', ALICE));
    const lectura = await assertSucceeds(getDocs(propios));
    expect(lectura.size).toBe(1);
    expect(lectura.docs[0].data().userId).toBe(ALICE);

    await assertFails(getDocs(collection(dbDe(ALICE), 'cases')));
    await assertFails(
      getDocs(query(collection(dbDe(ALICE), 'cases'), where('userId', '==', BOB)))
    );
  });

  it('permite actualizar el caso propio sin cambiar el dueño', async () => {
    await sembrar('cases/de-alice', { userId: ALICE, datos: { estado: 'borrador' } });

    await assertSucceeds(
      updateDoc(doc(dbDe(ALICE), 'cases/de-alice'), { datos: { estado: 'aprobado' } })
    );
  });

  it('rechaza cambiar el userId al actualizar', async () => {
    await sembrar('cases/de-alice', { userId: ALICE });

    await assertFails(
      updateDoc(doc(dbDe(ALICE), 'cases/de-alice'), { userId: BOB })
    );
    await assertFails(
      updateDoc(doc(dbDe(BOB), 'cases/de-alice'), { datos: {} })
    );
  });

  it('permite borrar el caso propio y rechaza el ajeno', async () => {
    await sembrar('cases/de-alice', { userId: ALICE });
    await sembrar('cases/de-bob', { userId: BOB });

    await assertFails(deleteDoc(doc(dbDe(ALICE), 'cases/de-bob')));
    await assertSucceeds(deleteDoc(doc(dbDe(ALICE), 'cases/de-alice')));
  });
});

describe('notary_profiles', () => {
  it('solo permite leer y escribir el perfil propio', async () => {
    await assertSucceeds(
      setDoc(doc(dbDe(ALICE), `notary_profiles/${ALICE}`), { notaria: 'Notaría' })
    );
    await assertSucceeds(getDoc(doc(dbDe(ALICE), `notary_profiles/${ALICE}`)));
    await assertFails(getDoc(doc(dbDe(ALICE), `notary_profiles/${BOB}`)));
    await assertFails(
      setDoc(doc(dbDe(ALICE), `notary_profiles/${BOB}`), { notaria: 'Otra' })
    );
    await assertFails(getDoc(doc(dbAnonima(), `notary_profiles/${ALICE}`)));
  });
});

describe('audit_logs', () => {
  it('el cliente no puede escribir ni alterar el audit log', async () => {
    await sembrar('audit_logs/log-1', { userId: ALICE, accion: 'update' });
    const db = dbDe(ALICE);

    await assertFails(setDoc(doc(db, 'audit_logs/nuevo'), { userId: ALICE }));
    await assertFails(updateDoc(doc(db, 'audit_logs/log-1'), { accion: 'falso' }));
    await assertFails(deleteDoc(doc(db, 'audit_logs/log-1')));
  });

  it('solo permite leer los logs propios y exige el filtro userId', async () => {
    await sembrar('audit_logs/log-alice', { userId: ALICE });
    await sembrar('audit_logs/log-bob', { userId: BOB });

    await assertSucceeds(getDoc(doc(dbDe(ALICE), 'audit_logs/log-alice')));
    await assertFails(getDoc(doc(dbDe(ALICE), 'audit_logs/log-bob')));

    const propios = query(
      collection(dbDe(ALICE), 'audit_logs'),
      where('userId', '==', ALICE)
    );
    const lectura = await assertSucceeds(getDocs(propios));
    expect(lectura.size).toBe(1);

    await assertFails(getDocs(collection(dbDe(ALICE), 'audit_logs')));
  });
});

describe('audit_heads', () => {
  it('solo permite leer la cabeza propia y nunca escribirla desde el cliente', async () => {
    await sembrar('audit_heads/caso-alice', { userId: ALICE, hash: 'abc' });
    await sembrar('audit_heads/caso-bob', { userId: BOB, hash: 'def' });
    const db = dbDe(ALICE);

    await assertSucceeds(getDoc(doc(db, 'audit_heads/caso-alice')));
    await assertFails(getDoc(doc(db, 'audit_heads/caso-bob')));

    await assertFails(setDoc(doc(db, 'audit_heads/caso-alice'), { userId: ALICE, hash: 'falso' }));
    await assertFails(updateDoc(doc(db, 'audit_heads/caso-alice'), { hash: 'falso' }));
    await assertFails(deleteDoc(doc(db, 'audit_heads/caso-alice')));
  });
});

describe('users', () => {
  it('solo permite acceder al documento del propio usuario', async () => {
    await assertSucceeds(setDoc(doc(dbDe(ALICE), `users/${ALICE}`), { nombre: 'Alice' }));
    await assertSucceeds(getDoc(doc(dbDe(ALICE), `users/${ALICE}`)));
    await assertFails(getDoc(doc(dbDe(ALICE), `users/${BOB}`)));
    await assertFails(setDoc(doc(dbDe(ALICE), `users/${BOB}`), { nombre: 'Bob' }));
  });
});
