// Membros que podem ver, criar, editar e confirmar presença nos eventos.
export const MEMBERS = {
  237622: "Dalton Araújo de Sampaio",
  297994: "Dannilo Neiva de Carvalho",
  300710: "Fabio Leal da Silva Viana",
  135756: "Francisco Pereira da Silva",
  304531: "Jean Sydney Pereira Macedo de Almeida",
  237627: "Luís Sebastião de Carvalho Júnior",
  189068: "Péricles Luiz Candeira Barros",
  194108: "Paulo Ferreira dos Santos",
  193149: "Francisco Valdeci de Sousa Cavalcante",
  315690: "Vicente de Paulo da Costa Veloso",
  334960: "Walter Luiz Pereira de Andrade",
  288871: "Walterwilson Carvalho Leite",
};

export function isAllowedCim(cim) {
  return cim != null && Object.hasOwn(MEMBERS, String(cim).trim());
}

export function memberName(cim) {
  return MEMBERS[String(cim)] ?? String(cim);
}
