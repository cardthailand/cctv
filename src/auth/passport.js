const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcrypt');
const userService = require('../services/userService');
const { config, isGoogleOAuthEnabled } = require('../config');

function serializeUser(user, done) {
  done(null, user.id);
}

async function deserializeUser(id, done) {
  try {
    const user = await userService.findById(id);
    if (!user || !user.isActive) {
      return done(null, false);
    }
    const channels = await userService.getUserChannels(user.id, user.role);
    done(null, { ...user, channels });
  } catch (error) {
    done(error);
  }
}

function configurePassport() {
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await userService.findByUsername(username);
        if (!user || !user.is_active) {
          return done(null, false, { message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
        if (!user.password_hash) {
          return done(null, false, { message: 'บัญชีนี้ใช้ OAuth เท่านั้น' });
        }
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
          return done(null, false, { message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
        const mapped = userService.mapUser(user);
        const channels = await userService.getUserChannels(mapped.id, mapped.role);
        return done(null, { ...mapped, channels });
      } catch (error) {
        return done(error);
      }
    })
  );

  if (isGoogleOAuthEnabled()) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.auth.google.clientId,
          clientSecret: config.auth.google.clientSecret,
          callbackURL: config.auth.google.callbackUrl,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value || null;
            const user = await userService.upsertOAuthUser({
              email,
              displayName: profile.displayName,
              provider: 'google',
              sub: profile.id,
            });
            const channels = await userService.getUserChannels(user.id, user.role);
            done(null, { ...user, channels });
          } catch (error) {
            done(error);
          }
        }
      )
    );
  }

  passport.serializeUser(serializeUser);
  passport.deserializeUser(deserializeUser);
}

module.exports = { configurePassport };
