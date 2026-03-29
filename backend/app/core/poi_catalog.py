from dataclasses import dataclass


@dataclass(frozen=True)
class CuratedPoi:
    title: str
    location: str
    category: str
    description: str
    region: str
    keywords: tuple[str, ...]


CURATED_POIS: tuple[CuratedPoi, ...] = (
    CuratedPoi(
        title='Monsanto',
        location='Idanha-a-Nova',
        category='monument',
        description='Aldeia historica em granito com vistas amplas e percurso pedonal.',
        region='castelo branco',
        keywords=('monsanto', 'aldeia historica', 'granito', 'castelo branco', 'historia'),
    ),
    CuratedPoi(
        title='Idanha-a-Velha',
        location='Idanha-a-Nova',
        category='museum',
        description='Conjunto historico com ruinas romanas, muralhas e patrimonio arqueologico.',
        region='castelo branco',
        keywords=('idanha-a-velha', 'romano', 'historia', 'patrimonio', 'arqueologia'),
    ),
    CuratedPoi(
        title='Castelo de Belmonte',
        location='Belmonte',
        category='monument',
        description='Castelo medieval associado a Pedro Alvares Cabral e ao centro historico.',
        region='castelo branco',
        keywords=('belmonte', 'castelo', 'medieval', 'historia'),
    ),
    CuratedPoi(
        title='Jardim do Paco Episcopal',
        location='Castelo Branco',
        category='nature',
        description='Jardim barroco com lagos, escadarias e leitura tranquila do centro urbano.',
        region='castelo branco',
        keywords=('jardim', 'paco episcopal', 'castelo branco', 'natureza', 'barroco'),
    ),
    CuratedPoi(
        title='Serra da Estrela',
        location='Seia',
        category='nature',
        description='Paisagem de montanha, miradouros e percursos panoramicos para um dia inteiro.',
        region='guarda',
        keywords=('serra da estrela', 'natureza', 'montanha', 'trilho', 'panoramico'),
    ),
)


def search_curated_pois(query: str | None, region: str | None, limit: int = 4) -> list[CuratedPoi]:
    normalized_query = _normalize(query)
    normalized_region = _normalize(region)

    scored: list[tuple[int, CuratedPoi]] = []
    for poi in CURATED_POIS:
        score = 0

        if normalized_region and normalized_region in poi.region:
            score += 3

        if normalized_query:
            if normalized_query in _normalize(poi.title):
                score += 5
            if normalized_query in _normalize(poi.description):
                score += 2
            if any(normalized_query in keyword for keyword in poi.keywords):
                score += 4

            query_tokens = [token for token in normalized_query.split() if token]
            token_matches = sum(
                1
                for token in query_tokens
                if token in _normalize(poi.title)
                or token in _normalize(poi.description)
                or any(token in keyword for keyword in poi.keywords)
            )
            score += token_matches

        if not normalized_query and not normalized_region:
            score = 1

        if score > 0:
            scored.append((score, poi))

    scored.sort(key=lambda entry: (-entry[0], entry[1].title))
    return [poi for _, poi in scored[: max(1, min(limit, 4))]]


def _normalize(value: str | None) -> str:
    if not value:
        return ''

    return ' '.join(value.lower().split())