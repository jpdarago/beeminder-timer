{
  pkgs,
  lib,
  config,
  ...
}:
{
  # https://devenv.sh/languages/
  languages = {
    typescript.enable = true;
    javascript.enable = true;
  };

  # https://devenv.sh/packages/
  packages = [
    pkgs.nodejs
    pkgs.nodePackages.npm # If using npm
    # pkgs.nodePackages.yarn # If using yarn instead
    # pkgs.nodePackages.pnpm # If using pnpm instead
  ];

  # You can add start script in processes section
  # processes.dev.exec = "npm run dev";
  # processes.build.exec = "npm run build";

  # See full reference at https://devenv.sh/reference/options/
}
