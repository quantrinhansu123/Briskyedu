/**
 * SearchableClassDropdown Component
 *
 * A reusable searchable dropdown for selecting classes with:
 * - Branch filter (cơ sở)
 * - Text search by class name, teacher, or branch
 * - Keyboard navigation support
 *
 * @usage
 * <SearchableClassDropdown
 *   classes={classes}
 *   selectedClassId={selectedClassId}
 *   onSelect={(classId) => setSelectedClassId(classId)}
 *   disabled={loading}
 * />
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { ClassModel } from '../../../../types';

export interface SearchableClassDropdownProps {
  /** List of available classes */
  classes: ClassModel[];
  /** Currently selected class ID */
  selectedClassId: string;
  /** Callback when a class is selected */
  onSelect: (classId: string) => void;
  /** Disable the dropdown */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Custom class name for the container */
  className?: string;
}

export const SearchableClassDropdown: React.FC<SearchableClassDropdownProps> = ({
  classes,
  selectedClassId,
  onSelect,
  disabled = false,
  placeholder = 'Tìm kiếm lớp...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 280 });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

  // Get selected class object
  const selectedClass = useMemo(() =>
    classes.find(c => c.id === selectedClassId),
    [classes, selectedClassId]
  );

  // Extract unique branches from classes
  const availableBranches = useMemo(() => {
    const branches = new Set<string>();
    classes.forEach(c => {
      if (c.branch) branches.add(c.branch);
    });
    return Array.from(branches).sort();
  }, [classes]);

  // Filter classes based on branch and search term
  const filteredClasses = useMemo(() => {
    let result = classes;

    // Filter by branch if selected
    if (selectedBranch) {
      result = result.filter(c => c.branch === selectedBranch);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      result = result.filter(c =>
        c.name.toLowerCase().includes(searchLower) ||
        c.teacher?.toLowerCase().includes(searchLower) ||
        c.branch?.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [classes, selectedBranch, searchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredClasses.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredClasses.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredClasses[highlightedIndex]) {
          handleSelect(filteredClasses[highlightedIndex].id);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (classId: string) => {
    onSelect(classId);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    onSelect('');
    setSearchTerm('');
    setSelectedBranch('');
  };

  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    // Clear selection if current class is not in the new branch
    if (selectedClassId) {
      const currentClass = classes.find(c => c.id === selectedClassId);
      if (branch && currentClass?.branch !== branch) {
        onSelect('');
      }
    }
    setSearchTerm('');
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* Branch filter - only show if there are branches */}
      {availableBranches.length > 0 && (
        <select
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[140px] focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          value={selectedBranch}
          onChange={(e) => handleBranchChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">Tất cả cơ sở</option>
          {availableBranches.map(branch => (
            <option key={branch} value={branch}>{branch}</option>
          ))}
        </select>
      )}

      {/* Searchable dropdown */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            className="px-3 py-2 pl-9 pr-8 border border-gray-300 rounded-lg text-sm w-[280px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={isOpen ? searchTerm : (selectedClass?.name || '')}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setHighlightedIndex(0);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => {
              setIsOpen(true);
              if (selectedClass) setSearchTerm('');
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />

          {/* Clear button */}
          {selectedClassId && !isOpen && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              tabIndex={-1}
            >
              <X size={14} />
            </button>
          )}

          {/* Dropdown indicator */}
          {!selectedClassId && (
            <ChevronDown
              className={`absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              size={16}
            />
          )}
        </div>

        {/* Dropdown results - using fixed positioning to escape container overflow */}
        {isOpen && (
          <div
            ref={listRef}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 99999
            }}
            className="bg-white border border-gray-300 rounded-lg shadow-2xl max-h-[300px] overflow-y-auto"
          >
            {filteredClasses.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-500 text-center">
                Không tìm thấy lớp nào
                {searchTerm && (
                  <p className="text-xs text-gray-400 mt-1">
                    Thử tìm kiếm với từ khóa khác
                  </p>
                )}
              </div>
            ) : (
              filteredClasses.map((c, index) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                    index === highlightedIndex
                      ? 'bg-indigo-100 text-indigo-700'
                      : selectedClassId === c.id
                        ? 'bg-indigo-50'
                        : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{c.name}</span>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      {c.branch && <span>{c.branch}</span>}
                      {c.branch && c.schedule && <span>•</span>}
                      {c.schedule && <span className="truncate">{c.schedule}</span>}
                    </div>
                  </div>
                  {c.teacher && (
                    <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">{c.teacher}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchableClassDropdown;
