
const MainContentArea = memo(({
  filteredDataLength,
  deferredFilteredData,
  groupedData,
  viewMode,
  groupBy,
  activeTag,
  visibleCount,
  searchTerm,
  compareList,
  expandedGroups,
  isExpandAll,
  isSearching,
  clearAllFilters,
  setPinnedVars,
  setCompareList,
  handleTagClick,
  openInstrumentModal,
  setCodeGenModalData,
  toggleGroup,
  observerTarget
}) => {
  return (
          <main className="main-content-scroll" style={{ padding: '0 3rem 3rem 3rem', width: '100%', boxSizing: 'border-box' }}>
      {filteredDataLength === 0 ? (
        <motion.div 
          className="empty-state"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
            padding: '6rem 2rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px dashed var(--border-color)', 
            marginTop: '2rem'
          }}
        >
          <SearchX size={64} style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', opacity: 0.5 }} />
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No variables found</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.6 }}>We couldn't find any variables matching your current filters and search terms.</p>
          <button 
            className="icon-btn active" 
            onClick={clearAllFilters} 
            style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600 }}
          >
            Clear All Filters
          </button>
        </motion.div>
      ) : groupBy === 'None' ? (
        <>
          {SAP_AIMS[activeTag] && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{activeTag}</h3>
              <p style={{ margin: 0, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{SAP_AIMS[activeTag]}</p>
            </div>
          )}
          {viewMode === 'table' ? (
            <div className="table-view-container">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>Variable Name</th>
                    <th>Label / Description</th>
                    <th>Measurement Level</th>
                    <th>Data Type</th>
                    <th>Program</th><th>SAP Category</th>
                  </tr>
                </thead>
                <tbody>
                  {deferredFilteredData.slice(0, visibleCount).map(item => (
                    <tr key={item._uid}>
                      <td style={{fontWeight: 600}}>{item['Variable Name']}</td>
                      <td>
                        <div style={{fontWeight: 500, marginBottom: '0.25rem'}}>{item['Label']}</div>
                        <div style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>{item['Description']}</div>
                      </td>
                      <td>
                        {item['Measurement Level'] && (
                          <span className={`badge ${getMLClass(item['Measurement Level'])}`} style={{fontSize: '0.75rem', padding: '2px 6px'}}>{item['Measurement Level']}</span>
                        )}
                      </td>
                      <td>{item['Data Type']}</td>
                      <td>{item['Program']}</td><td>{item['SAP Category']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
          <div className={`data-grid ${viewMode}`}>
            {deferredFilteredData.slice(0, visibleCount).map((item) => (
              <DataCard 
                key={item._uid}
                item={item}
                searchTerm={searchTerm}
                
                setPinnedVars={setPinnedVars}
                compareList={compareList}
                setCompareList={setCompareList}
                handleTagClick={handleTagClick}
                openInstrumentModal={openInstrumentModal}
                setCodeGenModalData={setCodeGenModalData}
                viewMode={viewMode}
              />
            ))}
          </div>
          )}
          {visibleCount < deferredFilteredData.length && (
            <div ref={observerTarget} style={{ height: '20px', width: '100%', marginTop: '20px' }} />
          )}
        </>
      ) : groupBy === 'Analysis' ? (
        /* ── Analysis Group View: flat sections, no accordion ── */
        <div className="analysis-sections">
          {Object.entries(groupedData).map(([groupName, items]) => {
            const sapClass = groupName === 'Primary Analysis' ? 'sap-primary'
              : groupName === 'Secondary Analysis' ? 'sap-secondary'
              : groupName === 'Covariates' ? 'sap-covariates'
              : groupName === 'Implementation' ? 'sap-implementation' : '';

            return (
              <div className="analysis-section" key={groupName}>
                <div className="analysis-section-header">
                  <div className="analysis-section-top">
                    <span className={`badge ${sapClass}`}>{groupName}</span>
                    <span className="analysis-section-count">{items.length} variable{items.length !== 1 ? 's' : ''}</span>
                  </div>
                  {SAP_AIMS[groupName] && (
                    <p className="analysis-section-aim">{SAP_AIMS[groupName]}</p>
                  )}
                </div>
                {viewMode === 'table' ? (
                  <div className="table-view-container">
                    <table className="compact-table">
                      <thead>
                        <tr>
                          <th>Variable Name</th>
                          <th>Label / Description</th>
                          <th>Measurement Level</th>
                          <th>Data Type</th>
                          <th>Program</th><th>SAP Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => (
                          <tr key={item._uid}>
                            <td style={{fontWeight: 600}}>{item['Variable Name']}</td>
                            <td>
                              <div style={{fontWeight: 500, marginBottom: '0.25rem'}}>{item['Label']}</div>
                              <div style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>{item['Description']}</div>
                            </td>
                            <td>
                              {item['Measurement Level'] && (
                                <span className={`badge ${getMLClass(item['Measurement Level'])}`} style={{fontSize: '0.75rem', padding: '2px 6px'}}>{item['Measurement Level']}</span>
                              )}
                            </td>
                            <td>{item['Data Type']}</td>
                            <td>{item['Program']}</td><td>{item['SAP Category']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={`data-grid ${viewMode}`}>
                    {items.map((item) => (
                      <DataCard 
                        key={item._uid}
                        item={item}
                        searchTerm={searchTerm}
                        
                        setPinnedVars={setPinnedVars}
                        compareList={compareList}
                        setCompareList={setCompareList}
                        handleTagClick={handleTagClick}
                        openInstrumentModal={openInstrumentModal}
                        setCodeGenModalData={setCodeGenModalData}
                        viewMode={viewMode}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="accordion-list">
          {Object.entries(groupedData).map(([groupName, items]) => {
            const hasActiveFilters = filterSetting !== '' || filterDataType !== '' || activeTag !== null || selectedInterventions.size < 3 || selectedInstruments.size > 0;
            const isExpanded = expandedGroups[groupName] !== undefined
              ? expandedGroups[groupName]
              : (isExpandAll || isSearching || hasActiveFilters);
            
            return (
              <div className={`accordion-item ${isExpanded ? 'expanded' : ''}`} key={groupName}>
                <button 
                  className="accordion-header" 
                  onClick={() => toggleGroup(groupName, isExpanded)}
                  data-tooltip={`Click to ${isExpanded ? 'collapse' : 'expand'} group`}
                  aria-expanded={isExpanded}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="accordion-title-wrapper">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      <h2 className="accordion-title">
                        {PROGRAM_FULL_NAMES[groupName] || groupName}
                      </h2>
                    </div>
                    <span className="accordion-badge">{items.length} variables</span>
                  </div>
                </button>
                
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="accordion-content">
                        <div className="accordion-inner">
                          {viewMode === 'table' ? (
                            <div className="table-view-container">
                              <table className="compact-table">
                                <thead>
                                  <tr>
                                    <th>Variable Name</th>
                                    <th>Label / Description</th>
                                    <th>Measurement Level</th>
                                    <th>Data Type</th>
                                    <th>Program</th><th>SAP Category</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map(item => (
                                    <tr key={item._uid}>
                                      <td style={{fontWeight: 600}}>{item['Variable Name']}</td>
                                      <td>
                                        <div style={{fontWeight: 500, marginBottom: '0.25rem'}}>{item['Label']}</div>
                                        <div style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>{item['Description']}</div>
                                      </td>
                                      <td>
                                        {item['Measurement Level'] && (
                                          <span className={`badge ${getMLClass(item['Measurement Level'])}`} style={{fontSize: '0.75rem', padding: '2px 6px'}}>{item['Measurement Level']}</span>
                                        )}
                                      </td>
                                      <td>{item['Data Type']}</td>
                                      <td>{item['Program']}</td><td>{item['SAP Category']}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className={`data-grid ${viewMode}`}>
                              {items.map((item) => (
                                <DataCard 
                                  key={item._uid}
                                  item={item}
                                  searchTerm={searchTerm}
                                  
                                  setPinnedVars={setPinnedVars}
                                  compareList={compareList}
                                  setCompareList={setCompareList}
                                  handleTagClick={handleTagClick}
                                  openInstrumentModal={openInstrumentModal}
                                  setCodeGenModalData={setCodeGenModalData}
                                  viewMode={viewMode}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
              )}
            </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
      </main>
  );
});
