# Angular edu-sharing

This folder contains the frontend part of edu-sharing.

The frontend uses Angular 5 and TypeScript and builds via [angular-cli](https://github.com/angular/angular-cli).

Run "npm install" inside the project folder after checking out the project to fetch all dependencies.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive/pipe/service/class/module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `-prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Configure the test setup via `.env`.
If you test against `localhost:4200`, make sure you are serving the app via `ng serve`.
Run all tests using the command `npm run e2e`.

For more information, see [tests/README.md](tests/README.md).

## Deploying to GitHub Pages

Run `ng github-pages:deploy` to deploy to GitHub Pages.

## Further help

To get more help on the `angular-cli` use `ng help` or go check out the [Angular-CLI README](https://github.com/angular/angular-cli/blob/master/README.md).

## Build works but packaged electron apps wont :( Use project desktopApp.

## Managing routes

Routes are defined in the file /src/app/router.component.ts

## Managing language

Open the specific components lanaguge file, you can find them in src/assets/i18n/<component>/<language>.json
