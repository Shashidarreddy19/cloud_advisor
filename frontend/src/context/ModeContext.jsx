import { createContext, useState, useContext } from 'react';

const ModeContext = createContext();

export const ModeProvider = ({ children }) => {
    const [mode, setMode] = useState('cloud'); // 'cloud' or 'csv'

    return (
        <ModeContext.Provider value={{ mode, setMode }}>
            {children}
        </ModeContext.Provider>
    );
};

export const useMode = () => useContext(ModeContext);

export default ModeContext;
