          <div className="search-bar">
            <div className="search-input-wrapper" data-tooltip="Search by variable name, label, or description">
              <Search className="search-icon" />
              <div className="search-chips-container">
                {filterDataType && (
                  <div className="search-chip">
                    <span>Type: {filterDataType}</span>
                    <button onClick={() => setFilterDataType('')}><X size={12} /></button>
                  </div>
                )}
                {filterSetting && (
                  <div className="search-chip">
                    <span>Setting: {filterSetting}</span>
                    <button onClick={() => setFilterSetting('')}><X size={12} /></button>
                  </div>
                )}
                {activeTag && (
                  <div className="search-chip tag-chip">
                    <span><Tag size={10} /> {activeTag}</span>
                    <button onClick={() => setActiveTag(null)}><X size={12} /></button>
                  </div>
                )}
                <input 
                  type="text" 
                  className="search-input"
                  placeholder={(!filterDataType && !filterSetting && !activeTag) ? "Search variables by name, label, or description..." : ""} 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {(searchTerm || filterSetting || filterDataType || activeTag) && (
                  <button 
                    className="clear-search-btn"
                    aria-label="Clear all filters"
                    onClick={() => {
                      setSearchTerm('');
                      setFilterSetting('');
                      setFilterDataType('');
                      setActiveTag(null);
                    }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '0 8px' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="view-controls">
