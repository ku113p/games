import { buildGrid } from '../../core/grid'
import { l1 } from '../../levels/l1'
import cfgJson from '../../config.json'
try { buildGrid(l1, cfgJson.world); console.log('l1 ok') } catch (e) { console.log('l1 broken:', (e as Error).message) }
