# Police System Documentation

## Overview
The police system adds dynamic law enforcement to the game. Police cars patrol the city and will chase the player when they have a wanted level.

## Features

### Police Cars
- **4 Police Vehicles** spawn at strategic locations around the city
- **Blue & White Appearance** - Distinctive police car color scheme
- **Patrol Behavior** - Police cars follow normal traffic patterns when not chasing
- **Chase Mechanics** - When player has wanted level, police will pursue at higher speeds

### Wanted Level System
- **5 Star System** - Tracks player's wanted level (0-5 stars)
- **Visual Display** - Stars shown in top-right corner of screen
- **Automatic Decay** - Wanted level decreases over time when not in vehicle
- **Police Activation** - Police only chase when wanted level > 0

### Chase Mechanics
- **Detection Range** - Police detect player within 80 units
- **Chase Duration** - Police will chase for up to 30 seconds before giving up
- **Speed Boost** - Police cars drive 1.5x faster when chasing
- **Max Chase Speed** - Limited to 45 km/h to keep gameplay balanced

## Controls

### Cheats (while in vehicle)
- **G** - Gain 1 wanted level (trigger police chase)
- **C** - Clear wanted level (escape police)
- **R** - Reset vehicle if stuck

## How It Works

### Police Spawning
Police cars spawn at 4 locations:
- (50, 0, -50)
- (-50, 0, -50)
- (50, 0, 50)
- (-50, 0, 50)

### Chase Logic
1. Player drives vehicle and gains wanted level (press G)
2. Police within detection range (80 units) spot the player
3. Police cars accelerate and pursue the player
4. Chase continues for up to 30 seconds
5. If player escapes or clears wanted level (press C), police stop chasing
6. Wanted level decays automatically over time

### Performance
- Police use LOD (Level of Detail) system
- Only update when within 160 units of player
- Extends traffic system without significant performance impact

## Integration

### Files Added
- `src/game/Police.ts` - Police car class extending TrafficCar
- `src/game/WantedLevel.ts` - Wanted level tracking system

### Files Modified
- `src/game/Core.ts` - Added police spawning and update logic
- `index.html` - Added wanted level UI display

## Future Enhancements
- Police roadblocks
- Wanted level increase on collision with police
- Different police behaviors at higher wanted levels
- Police radio chatter audio
- Wanted level increase for traffic violations
- Escape zones to lose wanted level
