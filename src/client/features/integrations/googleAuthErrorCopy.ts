/**
 * Plain-language copy for Google OAuth failures, shared by the connect-surface
 * inline alert (GoogleLinkErrorAlert) and the /auth-error fallback page.
 * `code` is the `error` query param Better Auth appends on its error
 * redirects.
 *
 * `providerLabel` ("Search Console" / "Google Analytics") is set when the
 * failure came from a connect flow; without it the copy reads as a Google
 * sign-in failure.
 */
export function googleAuthErrorCopy(
  code: string,
  providerLabel?: string,
): { title: string; description: string } {
  const what = providerLabel
    ? `La conexión con ${providerLabel}`
    : "El inicio de sesión con Google";

  switch (code) {
    case "state_mismatch":
      return {
        title: `${what} no se completó`,
        description:
          "El intento caducó o se interrumpió. Vuelve a intentarlo en una sola pestaña del navegador y termina los pasos de Google en menos de 10 minutos. Si sigue pasando, asegúrate de que tu navegador permite cookies para este sitio.",
      };
    case "access_denied":
      return {
        title: `${what} se canceló`,
        description:
          "Se cerró o se rechazó la pantalla de permisos de Google. Vuelve a intentarlo cuando quieras.",
      };
    case "account_already_linked_to_different_user":
      return {
        title: "Esa cuenta de Google ya está conectada",
        description: providerLabel
          ? `Inicia sesión con el usuario de PlanetaSEO que la conectó, abre el selector de propiedad de ${providerLabel} y elige "Quitar cuenta" junto a la cuenta de Google. Luego conéctala aquí.`
          : "Esa cuenta de Google ya está vinculada a otro usuario de PlanetaSEO. Inicia sesión con ese usuario, o contacta con soporte.",
      };
    default:
      return {
        title: `${what} no se completó`,
        description:
          "Algo ha fallado al hablar con Google. Inténtalo de nuevo — si sigue fallando, contacta con soporte.",
      };
  }
}
