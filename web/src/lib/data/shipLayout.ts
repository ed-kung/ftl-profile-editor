/**
 * Ship layouts: "data/<layoutId>.txt".
 *
 * A saved game has no counts for a ship's rooms or doors. Their number, size
 * and order come from this file, so a layout must be parsed before a ship can.
 *
 * A port of net.blerf.ftl.parser.DatParser.readLayout.
 */

export interface ShipLayoutRoom {
  locationX: number
  locationY: number
  squaresH: number
  squaresV: number
}

export interface ShipLayoutDoor {
  wallX: number
  wallY: number
  /** 1 for a vertical wall, 0 for a horizontal one. */
  vertical: number
  roomIdA: number
  roomIdB: number
}

export interface ShipLayout {
  /** Added to room locations, in squares. */
  offsetX: number
  offsetY: number
  /** Indexed by roomId. */
  rooms: ShipLayoutRoom[]
  /**
   * Doors in the order a saved game stores them, which is not the file's:
   * doors to vacuum (a room id of -1) are moved to the end.
   */
  doors: ShipLayoutDoor[]
}

export function parseShipLayout(text: string, layoutId: string): ShipLayout {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/)
  let at = 0

  const nextInt = (): number => {
    const line = lines[at++]
    const n = line === undefined ? NaN : Number(line)
    if (line === undefined || line.trim() === '' || !Number.isInteger(n)) {
      throw new Error(
        `Ship layout "${layoutId}" has "${line ?? 'end of file'}" on line ${at}, where a whole number was expected.`,
      )
    }
    return n
  }

  let offsetX = 0
  let offsetY = 0
  const roomsById = new Map<number, ShipLayoutRoom>()
  // Keyed like Java's LinkedHashMap: a repeated door keeps its first position
  // and the later values.
  const doorsByCoord = new Map<string, ShipLayoutDoor>()

  while (at < lines.length) {
    const line = lines[at++]

    if (line === 'X_OFFSET') {
      offsetX = nextInt()
    } else if (line === 'Y_OFFSET') {
      offsetY = nextInt()
    } else if (line === 'HORIZONTAL' || line === 'VERTICAL') {
      nextInt()
    } else if (line === 'ELLIPSE') {
      for (let i = 0; i < 4; i++) nextInt()
    } else if (line === 'ROOM') {
      const roomId = nextInt()
      const locationX = nextInt()
      const locationY = nextInt()
      const squaresH = nextInt()
      const squaresV = nextInt()
      roomsById.set(roomId, { locationX, locationY, squaresH, squaresV })
    } else if (line === 'DOOR') {
      const wallX = nextInt()
      const wallY = nextInt()
      const roomIdA = nextInt()
      const roomIdB = nextInt()
      const vertical = nextInt()
      doorsByCoord.set(`${wallX},${wallY},${vertical}`, {
        wallX,
        wallY,
        vertical,
        roomIdA,
        roomIdB,
      })
    }
  }

  const roomCount = roomsById.size === 0 ? 0 : Math.max(...roomsById.keys()) + 1
  const rooms: ShipLayoutRoom[] = []
  for (let roomId = 0; roomId < roomCount; roomId++) {
    const room = roomsById.get(roomId)
    if (!room) {
      throw new Error(`Ship layout "${layoutId}" has no room ${roomId}.`)
    }
    rooms.push(room)
  }

  const isVacuumDoor = (d: ShipLayoutDoor) => d.roomIdA === -1 || d.roomIdB === -1
  const allDoors = [...doorsByCoord.values()]

  return {
    offsetX,
    offsetY,
    rooms,
    doors: [
      ...allDoors.filter((d) => !isVacuumDoor(d)),
      ...allDoors.filter(isVacuumDoor),
    ],
  }
}
