import { Db, ObjectId } from 'mongodb';
import { verifyRegistrationResponse, verifyAuthenticationResponse, VerifiedRegistrationResponse, VerifiedAuthenticationResponse } from '@simplewebauthn/server';
import { generateRegOptions, generateAuthOptions, consumeChallenge, cleanOldChallenges, getWebAuthnConfig } from '../../infrastructure/webauthn';

interface PasskeyStored {
  id: string;
  credentialID: string;
  credentialPublicKey: string;
  counter: number;
  transports?: string[];
  name: string;
  createdAt: number;
  deviceType?: string;
  backedUp?: boolean;
}

export default class PasskeyServices {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async getRegistrationOptions(email: string): Promise<any> {
    await cleanOldChallenges(this.db);
    const existingPasskeys = await this.getPasskeys(email);
    const options = await generateRegOptions(this.db, email, existingPasskeys);
    return options;
  }

  async registerPasskey(email: string, response: any, passkeyName?: string): Promise<PasskeyStored> {
    const expectedChallenge = await consumeChallenge(this.db, 'registration', email);
    if (!expectedChallenge) {
      throw new Error('Challenge scaduta o non valida');
    }

    const { rpID, rpOrigin } = getWebAuthnConfig();

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: rpOrigin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });
    } catch (error: any) {
      throw new Error(`Errore nella verifica della passkey: ${error.message}`);
    }

    const { verified, registrationInfo } = verification;
    if (!verified || !registrationInfo) {
      throw new Error('Registrazione passkey fallita');
    }

    const cred = registrationInfo.credential;

    const passkey: PasskeyStored = {
      id: new ObjectId().toString(),
      credentialID: cred.id,
      credentialPublicKey: Buffer.from(cred.publicKey).toString('base64url'),
      counter: cred.counter,
      transports: cred.transports || [],
      name: passkeyName || `Passkey ${registrationInfo.credentialDeviceType || 'dispositivo'}`,
      createdAt: Date.now(),
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
    };

    await this.db.collection('users').updateOne(
      { email },
      { $push: { passkeys: passkey as any } },
    );

    return passkey;
  }

  async getAuthenticationOptions(email: string): Promise<any> {
    await cleanOldChallenges(this.db);
    const passkeys = await this.getPasskeys(email);
    if (passkeys.length === 0) {
      throw new Error('Nessuna passkey registrata per questo utente');
    }
    const options = await generateAuthOptions(this.db, email, passkeys);
    return options;
  }

  async getAuthenticationOptionsByEmail(email: string): Promise<any> {
    await cleanOldChallenges(this.db);
    const passkeys = await this.getPasskeys(email);
    if (passkeys.length === 0) {
      throw new Error('Nessuna passkey registrata');
    }
    const options = await generateAuthOptions(this.db, email, passkeys);
    return options;
  }

  async verifyAuthentication(email: string, response: any): Promise<VerifiedAuthenticationResponse> {
    const expectedChallenge = await consumeChallenge(this.db, 'authentication', email);
    if (!expectedChallenge) {
      throw new Error('Challenge scaduta o non valida');
    }

    const { rpID, rpOrigin } = getWebAuthnConfig();

    const passkeys = await this.getPasskeys(email);
    const matchedPasskey = passkeys.find((pk) => pk.credentialID === response.id);
    if (!matchedPasskey) {
      throw new Error('Passkey non trovata');
    }

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: rpOrigin,
        expectedRPID: rpID,
        credential: {
          id: matchedPasskey.credentialID,
          publicKey: new Uint8Array(Buffer.from(matchedPasskey.credentialPublicKey, 'base64url')),
          counter: matchedPasskey.counter,
          transports: matchedPasskey.transports as any,
        },
        requireUserVerification: false,
      });
    } catch (error: any) {
      throw new Error(`Errore nella verifica: ${error.message}`);
    }

    const { verified, authenticationInfo } = verification;
    if (!verified) {
      throw new Error('Autenticazione fallita');
    }

    await this.db.collection('users').updateOne(
      { email, 'passkeys.credentialID': matchedPasskey.credentialID },
      { $set: { 'passkeys.$.counter': authenticationInfo.newCounter } },
    );

    return verification;
  }

  async getPasskeys(email: string): Promise<PasskeyStored[]> {
    const user = await this.db.collection('users').findOne(
      { email },
      { projection: { passkeys: 1 } },
    );
    return user?.passkeys || [];
  }

  async deletePasskey(email: string, passkeyId: string): Promise<boolean> {
    const result = await this.db.collection('users').updateOne(
      { email },
      { $pull: { passkeys: { id: passkeyId } as any } },
    );
    return result.modifiedCount > 0;
  }
}
