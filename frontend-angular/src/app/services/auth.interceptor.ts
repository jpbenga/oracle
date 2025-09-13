
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { Auth, user } from '@angular/fire/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth: Auth = inject(Auth);
  const user$ = user(auth);

  return user$.pipe(
    switchMap(user => {
      if (!user) {
        return next(req);
      }
      return from(user.getIdToken()).pipe(
        switchMap(token => {
          const authReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`
            }
          });
          return next(authReq);
        })
      );
    })
  );
};
