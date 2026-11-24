# DSE Study Library

The homepage opens the subject picker for Biology and Economics. The app and its web-ready question banks live in `QB/`.

For a local preview with Node.js 20 or later, run `npm --prefix QB run dev` from this folder and open `http://127.0.0.1:4173/`.

Publish the `DSE Note` repository from GitHub Desktop. In the new GitHub repository, choose **Settings > Pages > Build and deployment > Source > GitHub Actions**. Run **Deploy DSE Study Library** from the **Actions** tab if the first run needs to be restarted after configuration. The deployed site opens the subject picker at the repository's Pages URL.

The workflow checks and builds `QB/` and publishes `QB/dist/`. The top-level `Bio resources/` and `Econ resources/` folders are local originals. The published question banks come from `QB/bank/`.
