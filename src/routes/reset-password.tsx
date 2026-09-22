import { useForm } from "@tanstack/react-form";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AuthPageCard,
  AuthPageShell,
  authRedirectSearchSchema,
} from "@/client/features/auth/AuthPage";
import { getFieldError, getFormError } from "@/client/lib/forms";
import { authClient } from "@/lib/auth-client";
import { isHostedClientAuthMode } from "@/lib/auth-mode";
import { getSignInSearch, normalizeAuthRedirect } from "@/lib/auth-redirect";
import {
  HOSTED_PASSWORD_MAX_LENGTH,
  HOSTED_PASSWORD_MIN_LENGTH,
} from "@/lib/auth-options";
import { z } from "zod";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(
        HOSTED_PASSWORD_MIN_LENGTH,
        `La contraseña debe tener al menos ${HOSTED_PASSWORD_MIN_LENGTH} caracteres.`,
      )
      .max(
        HOSTED_PASSWORD_MAX_LENGTH,
        `La contraseña debe tener como máximo ${HOSTED_PASSWORD_MAX_LENGTH} caracteres.`,
      ),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

const resetPasswordSearchSchema = authRedirectSearchSchema.extend({
  error: z.string().optional(),
  token: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: resetPasswordSearchSchema,
  component: ResetPasswordPage,
});

function getResetPasswordErrorMessage(error: string | undefined) {
  switch ((error ?? "").toLowerCase()) {
    case "invalid_token":
      return "Este enlace ya no es válido. Solicita uno nuevo para continuar.";
    case "token_expired":
      return "Este enlace ha caducado. Solicita uno nuevo para continuar.";
    default:
      return error
        ? "Este enlace ya no se puede usar. Solicita uno nuevo e inténtalo de nuevo."
        : null;
  }
}

function getResetPasswordPageCopy({
  isHostedMode,
  isComplete,
  routeError,
  hasToken,
}: {
  isHostedMode: boolean;
  isComplete: boolean;
  routeError: string | null;
  hasToken: boolean;
}) {
  if (!isHostedMode) {
    return {
      title: "Restablecer contraseña",
      helperText: "El restablecimiento de contraseña no está disponible ahora mismo.",
    };
  }

  if (isComplete) {
    return {
      title: "Contraseña actualizada",
      helperText:
        "Tu contraseña se ha actualizado. Inicia sesión con la nueva contraseña.",
    };
  }

  if (routeError || !hasToken) {
    return {
      title: "Enlace caducado",
      helperText:
        routeError ||
        "Este enlace ya no es válido. Solicita uno nuevo para continuar.",
    };
  }

  return {
    title: "Restablecer contraseña",
    helperText: "Elige una contraseña nueva para tu cuenta.",
  };
}

function ResetPasswordPage() {
  const search = Route.useSearch();
  const redirectTo = normalizeAuthRedirect(search.redirect);
  const isHostedMode = isHostedClientAuthMode();
  const routeError = getResetPasswordErrorMessage(search.error);
  const token = typeof search.token === "string" ? search.token : null;
  const form = useForm({
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: resetPasswordSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      if (!token) {
        formApi.setErrorMap({
          onSubmit: {
            form: "Este enlace ya no es válido. Solicita uno nuevo e inténtalo de nuevo.",
            fields: {},
          },
        });
        return;
      }

      try {
        const result = await authClient.resetPassword({
          newPassword: value.password,
          token,
        });

        if (result.error) {
          formApi.setErrorMap({
            onSubmit: {
              form: "Este enlace ya no es válido. Solicita uno nuevo e inténtalo de nuevo.",
              fields: {},
            },
          });
          return;
        }
      } catch {
        formApi.setErrorMap({
          onSubmit: {
            form: "No hemos podido actualizar tu contraseña ahora mismo. Inténtalo de nuevo.",
            fields: {},
          },
        });
      }
    },
  });

  return (
    <AuthPageShell>
      <form.Subscribe
        selector={(state) => ({
          isComplete: state.isSubmitSuccessful && !state.errorMap.onSubmit,
          submitError: state.errorMap.onSubmit,
          isSubmitting: state.isSubmitting,
        })}
      >
        {({ isComplete, submitError, isSubmitting }) => {
          const errorMessage = getFormError(submitError);
          const pageCopy = getResetPasswordPageCopy({
            isHostedMode,
            isComplete,
            routeError,
            hasToken: !!token,
          });

          return (
            <AuthPageCard
              title={pageCopy.title}
              helperText={pageCopy.helperText}
              footer={
                <p className="text-sm">
                  <Link
                    to="/sign-in"
                    search={getSignInSearch(redirectTo)}
                    className="text-base-content/50 hover:text-base-content transition-colors"
                  >
                    Iniciar sesión
                  </Link>
                </p>
              }
            >
              {!isHostedMode ? null : isComplete ? (
                <a
                  href={
                    redirectTo === "/"
                      ? "/sign-in"
                      : `/sign-in?redirect=${encodeURIComponent(redirectTo)}`
                  }
                  className="btn btn-soft w-full"
                >
                  Ir a iniciar sesión
                </a>
              ) : routeError || !token ? (
                <Link
                  to="/forgot-password"
                  search={getSignInSearch(redirectTo)}
                  className="btn btn-soft w-full"
                >
                  Solicitar un enlace nuevo
                </Link>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void form.handleSubmit();
                  }}
                >
                  <form.Field name="password">
                    {(field) => {
                      const error = getFieldError(field.state.meta.errors);

                      return (
                        <div>
                          <input
                            type="password"
                            className="input input-bordered w-full"
                            placeholder="Nueva contraseña..."
                            value={field.state.value}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoComplete="new-password"
                            minLength={HOSTED_PASSWORD_MIN_LENGTH}
                            maxLength={HOSTED_PASSWORD_MAX_LENGTH}
                            required
                          />
                          {error ? (
                            <p className="mt-1 text-sm text-error">{error}</p>
                          ) : null}
                        </div>
                      );
                    }}
                  </form.Field>

                  <form.Field name="confirmPassword">
                    {(field) => {
                      const error = getFieldError(field.state.meta.errors);

                      return (
                        <div>
                          <input
                            type="password"
                            className="input input-bordered w-full"
                            placeholder="Confirmar nueva contraseña..."
                            value={field.state.value}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoComplete="new-password"
                            minLength={HOSTED_PASSWORD_MIN_LENGTH}
                            maxLength={HOSTED_PASSWORD_MAX_LENGTH}
                            required
                          />
                          {error ? (
                            <p className="mt-1 text-sm text-error">{error}</p>
                          ) : null}
                        </div>
                      );
                    }}
                  </form.Field>

                  {errorMessage ? (
                    <p className="text-sm text-error">{errorMessage}</p>
                  ) : null}
                  <button
                    className="btn btn-soft w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Actualizando..." : "Actualizar contraseña"}
                  </button>
                </form>
              )}
            </AuthPageCard>
          );
        }}
      </form.Subscribe>
    </AuthPageShell>
  );
}
