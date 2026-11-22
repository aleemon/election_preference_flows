# Data files

All files are UTF-8 JSON. Vote counts are whole numbers of votes.

## elections.json

An array with one object per election, oldest first.

| Field | Meaning |
|---|---|
| `year`, `date` | Election year and date |
| `pm`, `govt` | Prime minister and governing party or coalition after the election |
| `enrolled`, `informal`, `formal` | National enrolment and House of Representatives votes |
| `seatsTotal` | Seats won by the listed parties |
| `parties` | `[{name, group, votes, seats}]`: national first preferences and seats. `group` sets the colour (`labor`, `liberal`, `country`, `coalition`, `greens`, …) |
| `system` | `"fptp"` (1901–1917) or `"pref"` |
| `tpp` | `{alp, coal, source}` national two-party-preferred votes, or `null`. `source` is `"AEC count"`, `"AEC"` or `"estimate"` |
| `flows` | `{method, nodes}` or `null`. `method` is `"aec"` (counted), `"modelled"` or `"estimate"`. Each node is `[name, group, firstPreferenceVotes, toCoalition, toLabor]` |

## states.json

`{ "<year>": { "<STATE>": { tpp: {alp, coal}, n: [nodes] } } }` for 2004–2025. Nodes use the same format as `flows.nodes` above.

## seats.json

`{ "<year>": { src, parties, seats } }` for every election.

- `src`: `"aec"` (2004–2025) or `"psephos"` (1901–2001)
- `parties`: party code → party name
- `seats`: an array of `[state, seatName, candidates, counts, flag?]`
  - `candidates`: `[[SURNAME, givenNames, partyCode, elected], …]`. `elected` is set by the AEC (2004–2025) and for the 1901 statewide contests; otherwise the winner is the candidate with the most votes at the final count
  - `counts`: one row per count. Row 0 is first preferences; each later row is every candidate's total after the next exclusion, with `0` once a candidate is excluded. Columns follow the order of `candidates`
  - `flag` (optional): `1` returned unopposed · `2` count couldn't be read, first preferences only · `3` totals change between counts in the source · `4` 1901 statewide multi-member electorate

## seat-data-review.csv

Seat records to check by hand against the original files, with a priority, the problem found, what the dashboard currently shows, and a link to the source file:

- **High:** the count couldn't be read, or a candidate seems to be missing from the candidate table. The dashboard shows first preferences only.
- **Medium:** vote totals change between counts by more than 1%, or an election is missing a seat in the source.
- **Low:** a name is spelt differently between the candidate table and the count and was matched as the same person.
