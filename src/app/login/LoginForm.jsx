"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Lock, Hash } from "lucide-react";
import { loginAction } from "@/app/actions/auth";

const INPUT =
  "w-full border border-gray-300 rounded-lg pl-9 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [showPalavra, setShowPalavra] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center px-4 py-16">
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg, transparent, transparent 40px,
            rgba(197,151,58,0.5) 40px, rgba(197,151,58,0.5) 41px
          )`,
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-white font-serif text-3xl font-bold">Agenda Privada</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <Lock size={14} className="text-gold" />
            </div>
            <div>
              <p className="font-semibold text-primary text-sm">Acesso Restrito</p>
              <p className="text-gray-400 text-xs">Exclusivo para membros autorizados</p>
            </div>
          </div>

          <form action={formAction} className="space-y-5">
            <div>
              <label htmlFor="cim" className="block text-sm font-medium text-gray-700 mb-1">
                CIM <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  id="cim"
                  name="cim"
                  required
                  inputMode="numeric"
                  autoComplete="username"
                  defaultValue={state?.values?.cim}
                  placeholder="Seu número de CIM"
                  className={`${INPUT} pr-4`}
                />
              </div>
            </div>


            <div>
              <label htmlFor="palavra" className="block text-sm font-medium text-gray-700 mb-1">
                Palavra de Verificação <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type={showPalavra ? "text" : "password"}
                  id="palavra"
                  name="palavra"
                  required
                  autoComplete="current-password"
                  placeholder="Palavra de verificação"
                  className={`${INPUT} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPalavra((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPalavra ? "Ocultar palavra" : "Mostrar palavra"}
                >
                  {showPalavra ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {state?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary hover:bg-primary-light text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? "Verificando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
