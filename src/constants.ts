export const enum E_CODES {
  E_CACHE_FORBIDDEN = 'E_CACHE_FORBIDDEN',
  E_NO_HANDLER = 'E_NO_HANDLER',
  E_CONFIG_PARAM_REQUIRED = "E_CONFIG_PARAM_REQUIRED",
  E_EMPTY_SAVE = "E_EMPTY_SAVE"
}


export const enum Events {
	ChunkResolved = 'ChunkResolved',
	HandlerInvoked = "HandlerInvoked"
}

export const enum WatcherEvents {
  Block = 'block',
  Unblock = 'unblock'
}