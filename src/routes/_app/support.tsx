import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SUPPORT_EMAIL = "arofrancisco@planetaprime.com";
const SUPPORT_WHATSAPP_URL =
  "https://wa.me/34643854237?text=Hola%2C%20tengo%20una%20duda%20sobre%20PlanetaSEO";

export const Route = createFileRoute("/_app/support")({
  component: SupportPage,
});

function SupportPage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SUPPORT_EMAIL);
    toast.success("Email copiado al portapapeles");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full overflow-auto bg-base-100 px-4 py-8 pb-24 md:px-6 md:py-12 md:pb-8">
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-medium text-base-content/40">
          Ayuda y soporte
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Queremos saber de ti
        </h1>
        <p className="mt-2 text-sm text-base-content/60">
          Escríbenos con tus ideas, problemas, preguntas o sugerencias —
          respondemos directamente, sin intermediarios.
        </p>

        <div className="mt-8 space-y-3">
          <div className="rounded-lg border border-base-300 px-5 py-4">
            <p className="text-sm font-semibold">Email</p>
            <p className="mt-1 text-sm text-base-content/60">
              Envíanos ideas, problemas, preguntas o feedback directamente.
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-base-300 bg-base-200/50 px-3 py-1.5 text-sm font-medium text-base-content transition-colors hover:bg-base-200"
            >
              <span className="font-mono text-xs">{SUPPORT_EMAIL}</span>
              {copied ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <Copy className="size-3.5 text-base-content/40" />
              )}
            </button>
          </div>

          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-base-300 px-5 py-4 transition-colors hover:border-base-content/20"
          >
            <p className="text-sm font-semibold">WhatsApp</p>
            <p className="mt-1 text-sm text-base-content/60">
              Escríbenos directamente por WhatsApp para una respuesta rápida.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-base-content">
              Abrir WhatsApp
              <span aria-hidden="true">&rarr;</span>
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
