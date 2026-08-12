// ============================================
// NS LUXURY VILLA — Image Asset Registry
// Maps real NS Villa photography to semantic roles
// ============================================
//
// ASSET INVENTORY (inspected visually):
//
// ns-logo.jpeg            → Official NS Luxury Villa logo (dark bg, cyan/gold swirl, bottle/glass silhouette, tagline "Arrive as a Guest, Stay as Family")
// villa-exterior-block-b  → 3-storey sandy/cream building exterior with wrought-iron balconies, Block B accommodation wing
// restaurant-bar-area     → Open-air restaurant/bar lounge with carved wooden pillars, African art, dining tables, TV, visible pool edge
// room-deluxe-king        → Deluxe king bedroom — dark wood bed frame, colorful bedding, gold curtains, AC unit, wall art
// room-single-bed         → Standard single room — grey upholstered bed, orange heart-pattern bedding, nightstand, phone
// room-twin-beds          → Twin room — two grey beds with orange bedding, wall-mounted TV, chevron curtains
// room-studio-suite       → Studio suite — bed + sofa + coffee table + fridge + coat hangers, grey/gold tones, tiled floor
// suite-living-area       → Suite living area — brown L-shaped sofa, wooden coffee table, TV, dining nook, water dispenser
//

import nsLogo from './images/ns-logo.jpeg';
import villaExterior from './images/villa-exterior-block-b.jpeg';
import restaurantBar from './images/restaurant-bar-area.jpeg';
import roomDeluxeKing from './images/room-deluxe-king.jpeg';
import roomSingleBed from './images/room-single-bed.jpeg';
import roomTwinBeds from './images/room-twin-beds.jpeg';
import roomStudioSuite from './images/room-studio-suite.jpeg';
import suiteLivingArea from './images/suite-living-area.jpeg';

/** Central asset registry for all real NS Luxury Villa photography */
export const villaAssets = {
  /** Official NS Luxury Villa logo with tagline */
  logo: nsLogo,

  /** Villa Block B exterior — 3-storey cream building with balconies */
  villaExterior,

  /** Open-air restaurant & bar lounge with carved pillars and African art */
  restaurantBar,

  /** Deluxe king bedroom — dark wood frame, gold curtains, AC */
  roomDeluxeKing,

  /** Standard single room — grey bed, orange bedding, nightstand */
  roomSingleBed,

  /** Twin room — two beds, wall-mounted TV */
  roomTwinBeds,

  /** Studio suite — bed + sofa + coffee table + fridge */
  roomStudioSuite,

  /** Suite living area — L-shaped sofa, TV, dining nook */
  suiteLivingArea,
} as const;

export default villaAssets;
