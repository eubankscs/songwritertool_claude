import React, { useState } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { ProjectScreen } from './screens/ProjectScreen';
import { ViewAllProjectsScreen } from './screens/ViewAllProjectsScreen';
import { EditorScreen } from './screens/EditorScreen';

type Route =
  | { screen: 'home' }
  | { screen: 'project'; projectId: string }
  | { screen: 'allProjects' }
  | { screen: 'editor'; songId: string };

export default function App(): React.ReactElement {
  const [route, setRoute] = useState<Route>({ screen: 'home' });

  const goHome = () => setRoute({ screen: 'home' });

  if (route.screen === 'home') {
    return (
      <HomeScreen
        onOpenSong={songId => setRoute({ screen: 'editor', songId })}
        onOpenProject={projectId => setRoute({ screen: 'project', projectId })}
        onViewAllProjects={() => setRoute({ screen: 'allProjects' })}
        onNewSong={songId => setRoute({ screen: 'editor', songId })}
      />
    );
  }

  if (route.screen === 'project') {
    return (
      <ProjectScreen
        projectId={route.projectId}
        onBack={goHome}
        onOpenSong={songId => setRoute({ screen: 'editor', songId })}
        onNewSong={songId => setRoute({ screen: 'editor', songId })}
      />
    );
  }

  if (route.screen === 'allProjects') {
    return (
      <ViewAllProjectsScreen
        onBack={goHome}
        onOpenProject={projectId => setRoute({ screen: 'project', projectId })}
      />
    );
  }

  if (route.screen === 'editor') {
    return <EditorScreen songId={route.songId} onBack={goHome} />;
  }

  return <></>;
}
