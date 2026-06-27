# Watchbox (nazwa robocza)

Chcę, aby ta aplikacja stała się nowym standardem wyszukiwania informacji o zegarkach w środowisku kolekcjonerów i entuzjastów. Powinna oferować rzetelne i aktualne dane oraz estetyczne, wysokiej jakości zdjęcia.

## Opis funkcjonalności

1. **Baza wiedzy** – możliwość swobodnego przeglądania informacji o zegarkach (zdjęcia, dane techniczne, aktualne ceny retail i resale w zależności od stanu).
   - Skąd pozyskać zdjęcia i dane?
2. **Wirtualne pudełko na zegarki** – możliwość dodania swojej kolekcji z istniejącej bazy. Wyszukiwanie odbywa się po marce, modelu lub numerze referencyjnym, a zdjęcia i dane techniczne uzupełniają się automatycznie. Dodatkowo istnieje możliwość dodawania własnych zdjęć.
3. **Lista życzeń** – miejsce na zegarki, które użytkownik chciałby dodać do kolekcji.
4. **Porównywarka** – możliwość porównania dowolnych dwóch lub trzech modeli z kolekcji lub bazy.
5. **Statystyki** – funkcjonalność pozwalająca ręcznie wybierać moment założenia i zdjęcia zegarka. Na podstawie tych informacji generowane są statystyki, dzięki którym użytkownik może sprawdzić, które zegarki nosi najczęściej, a które najrzadziej. To ważny moduł, ponieważ pracuję również nad produktem, który będzie można przymocować do zegarka, aby zbierał te dane automatycznie.
6. **Społeczność** – możliwość dzielenia się kolekcją, listą życzeń, statystykami itp.
7. **Doradca** – agent AI wyposażony w odpowiednie narzędzia.

## MVP

### MVP obejmuje

- Mechanizm kontroli dostępu (logowanie)
- Moduł **wirtualne pudełko na zegarki** (dodawanie, przeglądanie, edytowanie i usuwanie zegarków)
- Moduł **statystyki**

### Uzasadnienie wyboru zakresu MVP

Największą wartością produktu jest pierwszy punkt sekcji **opis funkcjonalności**, czyli **baza wiedzy**. Na tym etapie nie wiem jeszcze, skąd pozyskam wszystkie niezbędne dane, ale moim celem jest stworzenie kompleksowej bazy wiedzy. Jednak zgromadzenie danych, które umożliwią zadowalające działanie tego modułu, wymaga nakładu pracy znacznie wykraczającego poza zakres MVP. Z tego względu jako domenową funkcjonalność wersji MVP wybrałem moduł **statystyk**. Na tym etapie produkt nie będzie wyróżniał się na tle konkurencji, ale traktuję go jako pierwszy krok w kierunku realizacji pełnej wersji produktu.

### Opis modułu statystyk

Moduł statystyk umożliwia rejestrowanie czasu noszenia zegarków oraz analizę zgromadzonych danych. Dla każdego zegarka użytkownik może wskazać godzinę założenia i zdjęcia (HH:MM) dla dowolnie wybranej daty (bieżącej lub historycznej). Na podstawie zarejestrowanych danych generowane są wykresy prezentujące statystyki noszenia kolekcji w różnych przedziałach czasowych (np. tydzień, miesiąc i rok). Moduł może również prezentować statystyki zmian cen zegarków na podstawie danych pobieranych z bazy wiedzy.
